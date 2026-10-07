// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title GetStockRouter
 * @notice DEX swap aggregator router for Robinhood Chain.
 * Scans Uniswap v3 pools, handles atomic multicall routing, exact-input split trades,
 * and slippage enforcement with 0% added aggregator fees.
 */

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

interface IWETH is IERC20 {
    function deposit() external payable;
    function withdraw(uint256) external;
}

interface IUniswapV3Pool {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function fee() external view returns (uint24);
    function swap(
        address recipient,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 sqrtPriceLimitX96,
        bytes calldata data
    ) external returns (int256 amount0, int256 amount1);
}

interface IUniswapV3SwapCallback {
    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external;
}

contract GetStockRouter is IUniswapV3SwapCallback {
    address public immutable factory;
    address public immutable WETH9;

    struct SwapStep {
        address pool;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint160 sqrtPriceLimitX96;
    }

    struct ExactInputSplitParams {
        address tokenIn;
        address tokenOut;
        uint256 amountInTotal;
        uint256 amountOutMinimum;
        address recipient;
        uint256 deadline;
        SwapStep[] steps;
    }

    modifier checkDeadline(uint256 deadline) {
        require(block.timestamp <= deadline, "EXPIRED");
        _;
    }

    constructor(address _factory, address _weth) {
        require(_factory != address(0), "INVALID_FACTORY");
        require(_weth != address(0), "INVALID_WETH");
        factory = _factory;
        WETH9 = _weth;
    }

    receive() external payable {}

    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external override {
        require(amount0Delta > 0 || amount1Delta > 0, "INVALID_DELTA");
        address tokenIn = abi.decode(data, (address));
        uint256 amountToPay = amount0Delta > 0 ? uint256(amount0Delta) : uint256(amount1Delta);
        require(IERC20(tokenIn).transfer(msg.sender, amountToPay), "CALLBACK_PAY_FAILED");
    }

    /**
     * @notice Splits exact input across designated pools and verifies slippage.
     */
    function exactInputSplit(
        ExactInputSplitParams calldata params
    ) external payable checkDeadline(params.deadline) returns (uint256 totalAmountOut) {
        require(params.steps.length > 0, "NO_STEPS");
        require(params.amountInTotal > 0, "ZERO_INPUT");

        // Handle native ETH or ERC20 input
        if (msg.value > 0) {
            require(params.tokenIn == WETH9, "ETH_REQUIRES_WETH");
            require(msg.value >= params.amountInTotal, "INSUFFICIENT_ETH");
            IWETH(WETH9).deposit{value: params.amountInTotal}();
            if (msg.value > params.amountInTotal) {
                (bool success, ) = msg.sender.call{value: msg.value - params.amountInTotal}("");
                require(success, "REFUND_FAILED");
            }
        } else {
            require(
                IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountInTotal),
                "PULL_FAILED"
            );
        }

        uint256 balanceBefore = IERC20(params.tokenOut).balanceOf(address(this));

        for (uint256 i = 0; i < params.steps.length; i++) {
            SwapStep memory step = params.steps[i];
            require(step.amountIn > 0, "ZERO_STEP_AMOUNT");

            IUniswapV3Pool pool = IUniswapV3Pool(step.pool);
            bool zeroForOne = step.tokenIn == pool.token0();
            uint160 sqrtLimit = step.sqrtPriceLimitX96;
            if (sqrtLimit == 0) {
                sqrtLimit = zeroForOne ? 4295128740 : 1461446703485210103287273052203988822378723970341;
            }

            pool.swap(
                address(this),
                zeroForOne,
                int256(step.amountIn),
                sqrtLimit,
                abi.encode(step.tokenIn)
            );
        }

        uint256 balanceAfter = IERC20(params.tokenOut).balanceOf(address(this));
        totalAmountOut = balanceAfter - balanceBefore;
        require(totalAmountOut >= params.amountOutMinimum, "SLIPPAGE_EXCEEDED");

        // If output is WETH and recipient wants ETH
        if (params.tokenOut == WETH9 && params.recipient == msg.sender && address(this).balance >= totalAmountOut) {
            IWETH(WETH9).withdraw(totalAmountOut);
            (bool ethSent, ) = params.recipient.call{value: totalAmountOut}("");
            require(ethSent, "ETH_TRANSFER_FAILED");
        } else {
            require(IERC20(params.tokenOut).transfer(params.recipient, totalAmountOut), "OUTPUT_TRANSFER_FAILED");
        }
    }

    /**
     * @notice Multicall helper for batch execution
     */
    function multicall(bytes[] calldata data) external payable returns (bytes[] memory results) {
        results = new bytes[](data.length);
        for (uint256 i = 0; i < data.length; i++) {
            (bool success, bytes memory result) = address(this).delegatecall(data[i]);
            require(success, "MULTICALL_FAILED");
            results[i] = result;
        }
    }
}
