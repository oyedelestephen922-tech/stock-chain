// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title StonkPosition
 * @notice Concentrated liquidity manager paired with a StonkWell vault.
 * Manages tick ranges around the oracle price, facilitates keeper rebalance/harvest,
 * and handles pro-rata assets for in-kind redemptions.
 */

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

interface IStonkOracle {
    function getPrice(address token) external view returns (uint256 price, uint8 decimals);
}

contract StonkPosition {
    address public immutable well;
    address public keeper;
    address public equityToken;
    address public stableToken; // USDG
    address public oracle;

    int24 public tickLower;
    int24 public tickUpper;
    uint256 public activeStableAmount;
    uint256 public activeEquityAmount;
    uint256 public accruedFeeStable;

    event KeeperUpdated(address indexed prevKeeper, address indexed newKeeper);
    event RangeUpdated(int24 tickLower, int24 tickUpper);
    event LiquidityDeployed(uint256 stableAmount, uint256 equityAmount);
    event LiquidityPulled(uint256 stableAmount, uint256 equityAmount);
    event FeesHarvested(uint256 stableFee);

    modifier onlyWell() {
        require(msg.sender == well, "NOT_WELL");
        _;
    }

    modifier onlyKeeperOrWell() {
        require(msg.sender == keeper || msg.sender == well, "NOT_KEEPER_OR_WELL");
        _;
    }

    constructor(address _well, address _keeper) {
        require(_well != address(0), "INVALID_WELL");
        require(_keeper != address(0), "INVALID_KEEPER");
        well = _well;
        keeper = _keeper;
        emit KeeperUpdated(address(0), _keeper);
    }

    function setTokens(address _equityToken, address _stableToken, address _oracle) external onlyWell {
        require(_equityToken != address(0) && _stableToken != address(0), "INVALID_TOKENS");
        equityToken = _equityToken;
        stableToken = _stableToken;
        oracle = _oracle;
    }

    function setKeeper(address _newKeeper) external onlyWell {
        require(_newKeeper != address(0), "INVALID_KEEPER");
        emit KeeperUpdated(keeper, _newKeeper);
        keeper = _newKeeper;
    }

    /**
     * @notice Returns total USDG valuation of active liquidity held by this position manager
     */
    function getPositionAssets() external view returns (uint256 totalValueInStable) {
        uint256 stableBal = IERC20(stableToken).balanceOf(address(this));
        uint256 equityBal = IERC20(equityToken).balanceOf(address(this));
        
        uint256 equityValInStable = 0;
        if (equityBal > 0 && oracle != address(0)) {
            (uint256 price, uint8 decimals) = IStonkOracle(oracle).getPrice(equityToken);
            // Assuming stableToken has 6 decimals (USDG) and equity token has 18 decimals
            // price from oracle has 8 decimals (USD per 1e18 equity)
            equityValInStable = (equityBal * price * 1e6) / (10 ** decimals * 1e18);
        }

        totalValueInStable = stableBal + equityValInStable;
    }

    /**
     * @notice Deploys funds into the position
     */
    function deployLiquidity(uint256 stableAmount, uint256 equityAmount) external onlyWell {
        if (stableAmount > 0) {
            require(IERC20(stableToken).transferFrom(well, address(this), stableAmount), "PULL_STABLE_FAIL");
            activeStableAmount += stableAmount;
        }
        if (equityAmount > 0) {
            require(IERC20(equityToken).transferFrom(well, address(this), equityAmount), "PULL_EQUITY_FAIL");
            activeEquityAmount += equityAmount;
        }
        emit LiquidityDeployed(stableAmount, equityAmount);
    }

    /**
     * @notice Pulls funds back to the well
     */
    function pullLiquidity(uint256 stableAmount, uint256 equityAmount, address recipient) external onlyWell {
        if (stableAmount > 0) {
            uint256 bal = IERC20(stableToken).balanceOf(address(this));
            uint256 toSend = stableAmount > bal ? bal : stableAmount;
            if (toSend > 0) {
                IERC20(stableToken).transfer(recipient, toSend);
                activeStableAmount = activeStableAmount > toSend ? activeStableAmount - toSend : 0;
            }
        }
        if (equityAmount > 0) {
            uint256 bal = IERC20(equityToken).balanceOf(address(this));
            uint256 toSend = equityAmount > bal ? bal : equityAmount;
            if (toSend > 0) {
                IERC20(equityToken).transfer(recipient, toSend);
                activeEquityAmount = activeEquityAmount > toSend ? activeEquityAmount - toSend : 0;
            }
        }
        emit LiquidityPulled(stableAmount, equityAmount);
    }

    /**
     * @notice Keeper rebalance to center ticks around new oracle price
     */
    function rebalance(int24 newTickLower, int24 newTickUpper) external onlyKeeperOrWell {
        require(newTickLower < newTickUpper, "INVALID_TICKS");
        tickLower = newTickLower;
        tickUpper = newTickUpper;
        emit RangeUpdated(newTickLower, newTickUpper);
    }

    /**
     * @notice Pull accrued swap fees to the well
     */
    function harvest() external onlyKeeperOrWell returns (uint256 feesCollected) {
        // Collect fees (in a live pool context, collected from Uniswap v3 pool)
        feesCollected = accruedFeeStable;
        if (feesCollected > 0) {
            accruedFeeStable = 0;
            IERC20(stableToken).transfer(well, feesCollected);
        }
        emit FeesHarvested(feesCollected);
    }
}
