// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title StonkWell
 * @notice ERC-4626 Single-Sided Liquidity Well for tokenized equities on Robinhood Chain.
 * Accepts single-sided USDG, mints yield-bearing w{TICKER} shares,
 * manages automated concentrated liquidity via StonkPosition,
 * compounds 70% of fees via StonkFeeRouter, and allows in-kind exit via redeemInKind().
 */

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

interface IStonkPosition {
    function setTokens(address _equityToken, address _stableToken, address _oracle) external;
    function getPositionAssets() external view returns (uint256 totalValueInStable);
    function deployLiquidity(uint256 stableAmount, uint256 equityAmount) external;
    function pullLiquidity(uint256 stableAmount, uint256 equityAmount, address recipient) external;
    function rebalance(int24 newTickLower, int24 newTickUpper) external;
    function harvest() external returns (uint256 feesCollected);
}

interface IStonkFeeRouter {
    function distributeFee(address token, address well, uint256 amount) external returns (uint256 wellAmount, uint256 retireAmount);
}

contract StonkWell {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;

    address public immutable asset;       // USDG (6 decimals)
    address public immutable equityToken; // e.g. TSLA, NVDA (18 decimals)
    address public oracle;
    address public feeRouter;
    address public keeper;
    address public positionManager;
    address public owner;

    uint256 public maxCap;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares);
    event RedeemInKind(address indexed owner, uint256 shares, uint256 stableReceived, uint256 equityReceived);
    event PositionManagerUpdated(address indexed manager);
    event KeeperUpdated(address indexed keeper);
    event MaxCapUpdated(uint256 newCap);
    event Harvested(uint256 feeHarvested, uint256 compounded, uint256 retired);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    modifier onlyKeeper() {
        require(msg.sender == keeper || msg.sender == owner, "NOT_KEEPER");
        _;
    }

    constructor(
        string memory _name,
        string memory _symbol,
        address _equityToken,
        address _asset,
        address _oracle,
        address _feeRouter,
        address _keeper,
        uint256 _maxCap
    ) {
        require(_equityToken != address(0), "INVALID_EQUITY");
        require(_asset != address(0), "INVALID_ASSET");
        owner = msg.sender;
        name = _name;
        symbol = _symbol;
        equityToken = _equityToken;
        asset = _asset;
        oracle = _oracle;
        feeRouter = _feeRouter;
        keeper = _keeper;
        maxCap = _maxCap;
    }

    function setPositionManager(address _position) external onlyOwner {
        require(_position != address(0), "INVALID_POSITION_MANAGER");
        positionManager = _position;
        IStonkPosition(_position).setTokens(equityToken, asset, oracle);
        emit PositionManagerUpdated(_position);
    }

    function setKeeper(address _keeper) external onlyOwner {
        require(_keeper != address(0), "INVALID_KEEPER");
        keeper = _keeper;
        emit KeeperUpdated(_keeper);
    }

    function setMaxCap(uint256 _newCap) external onlyOwner {
        maxCap = _newCap;
        emit MaxCapUpdated(_newCap);
    }

    // --- ERC-20 Implementation ---

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address recipient, uint256 amount) external returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool) {
        uint256 currentAllowance = allowance[sender][msg.sender];
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= amount, "INSUFFICIENT_ALLOWANCE");
            allowance[sender][msg.sender] = currentAllowance - amount;
        }
        _transfer(sender, recipient, amount);
        return true;
    }

    function _transfer(address sender, address recipient, uint256 amount) internal {
        require(recipient != address(0), "INVALID_RECIPIENT");
        require(balanceOf[sender] >= amount, "INSUFFICIENT_BALANCE");
        balanceOf[sender] -= amount;
        balanceOf[recipient] += amount;
        emit Transfer(sender, recipient, amount);
    }

    // --- ERC-4626 Accounting ---

    function totalAssets() public view returns (uint256) {
        uint256 idleAssets = IERC20(asset).balanceOf(address(this));
        uint256 positionAssets = 0;
        if (positionManager != address(0)) {
            positionAssets = IStonkPosition(positionManager).getPositionAssets();
        }
        return idleAssets + positionAssets;
    }

    function convertToShares(uint256 assets) public view returns (uint256) {
        uint256 total = totalAssets();
        if (totalSupply == 0 || total == 0) {
            // Normalize 6 decimal assets to 18 decimal shares
            return assets * 1e12;
        }
        return (assets * totalSupply) / total;
    }

    function convertToAssets(uint256 shares) public view returns (uint256) {
        if (totalSupply == 0) {
            return shares / 1e12;
        }
        return (shares * totalAssets()) / totalSupply;
    }

    // --- Deposits & Withdrawals ---

    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        require(assets > 0, "ZERO_ASSETS");
        require(receiver != address(0), "INVALID_RECEIVER");
        uint256 total = totalAssets();
        require(maxCap == 0 || total + assets <= maxCap, "MAX_CAP_EXCEEDED");

        shares = convertToShares(assets);
        require(shares > 0, "ZERO_SHARES");

        require(IERC20(asset).transferFrom(msg.sender, address(this), assets), "PULL_ASSET_FAIL");

        totalSupply += shares;
        balanceOf[receiver] += shares;
        emit Transfer(address(0), receiver, shares);
        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function withdraw(uint256 assets, address receiver, address _owner) external returns (uint256 shares) {
        require(assets > 0, "ZERO_ASSETS");
        shares = convertToShares(assets);
        require(shares > 0, "ZERO_SHARES");

        if (msg.sender != _owner) {
            uint256 currentAllowance = allowance[_owner][msg.sender];
            if (currentAllowance != type(uint256).max) {
                require(currentAllowance >= shares, "INSUFFICIENT_ALLOWANCE");
                allowance[_owner][msg.sender] = currentAllowance - shares;
            }
        }

        require(balanceOf[_owner] >= shares, "INSUFFICIENT_SHARES");
        balanceOf[_owner] -= shares;
        totalSupply -= shares;
        emit Transfer(_owner, address(0), shares);

        // Ensure sufficient idle assets, pull from position if needed
        uint256 idle = IERC20(asset).balanceOf(address(this));
        if (idle < assets && positionManager != address(0)) {
            IStonkPosition(positionManager).pullLiquidity(assets - idle, 0, address(this));
        }

        require(IERC20(asset).transfer(receiver, assets), "TRANSFER_ASSET_FAIL");
        emit Withdraw(msg.sender, receiver, _owner, assets, shares);
    }

    /**
     * @notice Emergency / standard in-kind exit.
     * Burns shares and sends user their exact pro-rata proportion of idle USDG plus active equity tokens.
     */
    function redeemInKind(uint256 shares) external returns (uint256 stableReceived, uint256 equityReceived) {
        require(shares > 0, "ZERO_SHARES");
        require(balanceOf[msg.sender] >= shares, "INSUFFICIENT_SHARES");

        uint256 currentSupply = totalSupply;
        balanceOf[msg.sender] -= shares;
        totalSupply -= shares;
        emit Transfer(msg.sender, address(0), shares);

        // Pro-rata idle USDG
        uint256 idleUSDG = IERC20(asset).balanceOf(address(this));
        stableReceived = (idleUSDG * shares) / currentSupply;
        if (stableReceived > 0) {
            require(IERC20(asset).transfer(msg.sender, stableReceived), "TRANSFER_IDLE_FAIL");
        }

        // Pro-rata active position
        if (positionManager != address(0)) {
            uint256 posUSDG = IERC20(asset).balanceOf(positionManager);
            uint256 posEquity = IERC20(equityToken).balanceOf(positionManager);

            uint256 stableShare = (posUSDG * shares) / currentSupply;
            uint256 equityShare = (posEquity * shares) / currentSupply;

            if (stableShare > 0 || equityShare > 0) {
                IStonkPosition(positionManager).pullLiquidity(stableShare, equityShare, msg.sender);
                stableReceived += stableShare;
                equityReceived += equityShare;
            }
        }

        emit RedeemInKind(msg.sender, shares, stableReceived, equityReceived);
    }

    // --- Keeper Actions ---

    function rebalance(int24 newTickLower, int24 newTickUpper) external onlyKeeper {
        require(positionManager != address(0), "NO_POSITION_MANAGER");
        IStonkPosition(positionManager).rebalance(newTickLower, newTickUpper);
    }

    function harvest() external onlyKeeper returns (uint256 feesCollected) {
        require(positionManager != address(0), "NO_POSITION_MANAGER");
        feesCollected = IStonkPosition(positionManager).harvest();

        if (feesCollected > 0 && feeRouter != address(0)) {
            IERC20(asset).approve(feeRouter, feesCollected);
            (uint256 wellCompounded, uint256 retired) = IStonkFeeRouter(feeRouter).distributeFee(
                asset,
                address(this),
                feesCollected
            );
            emit Harvested(feesCollected, wellCompounded, retired);
        }
    }
}
