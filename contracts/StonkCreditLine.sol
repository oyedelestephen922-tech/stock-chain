// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title StonkCreditLine
 * @notice Isolated Borrow Desk for USDG credit against StonkWell vault shares.
 * 65% max LTV, 80% liquidation threshold, 5% liquidation incentive,
 * and 4.85% base APR interest accrual.
 */

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

interface IStonkWell {
    function convertToAssets(uint256 shares) external view returns (uint256);
}

contract StonkCreditLine {
    address public immutable asset;          // USDG (6 decimals)
    address public immutable collateralWell; // w{TICKER} Well shares
    address public owner;

    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant MAX_LTV_BPS = 6500;                  // 65% LTV
    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8000;    // 80% Threshold
    uint256 public constant LIQUIDATION_INCENTIVE_BPS = 500;     // 5% Incentive
    uint256 public constant SECONDS_PER_YEAR = 31536000;

    uint256 public baseAprBps = 485; // 4.85% base APR
    uint256 public totalBorrowed;
    uint256 public totalPledgedShares;

    struct Position {
        uint256 pledgedShares;
        uint256 principal;
        uint256 lastAccruedAt;
    }

    mapping(address => Position) public positions;

    event CollateralPledged(address indexed borrower, uint256 shares);
    event CollateralWithdrawn(address indexed borrower, uint256 shares);
    event CreditBorrowed(address indexed borrower, uint256 amount);
    event CreditRepaid(address indexed borrower, uint256 amount);
    event Liquidated(
        address indexed borrower,
        address indexed liquidator,
        uint256 repayAmount,
        uint256 sharesSeized
    );
    event LiquiditySupplied(address indexed supplier, uint256 amount);
    event LiquidityWithdrawn(address indexed recipient, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    constructor(address _asset, address _collateralWell) {
        require(_asset != address(0), "INVALID_ASSET");
        require(_collateralWell != address(0), "INVALID_COLLATERAL");
        owner = msg.sender;
        asset = _asset;
        collateralWell = _collateralWell;
    }

    /**
     * @notice Supplies liquidity to the credit desk for borrowers to draw
     */
    function supplyCreditLiquidity(uint256 amount) external {
        require(amount > 0, "ZERO_AMOUNT");
        require(IERC20(asset).transferFrom(msg.sender, address(this), amount), "PULL_FAIL");
        emit LiquiditySupplied(msg.sender, amount);
    }

    /**
     * @notice Admin withdrawal of unused credit liquidity
     */
    function withdrawCreditLiquidity(uint256 amount, address recipient) external onlyOwner {
        require(recipient != address(0), "INVALID_RECIPIENT");
        require(IERC20(asset).transfer(recipient, amount), "TRANSFER_FAIL");
        emit LiquidityWithdrawn(recipient, amount);
    }

    function _accrueInterest(Position storage pos) internal {
        if (pos.principal == 0 || pos.lastAccruedAt == 0) {
            pos.lastAccruedAt = block.timestamp;
            return;
        }
        uint256 elapsed = block.timestamp - pos.lastAccruedAt;
        if (elapsed > 0) {
            uint256 interest = (pos.principal * baseAprBps * elapsed) / (BPS_DENOMINATOR * SECONDS_PER_YEAR);
            pos.principal += interest;
            totalBorrowed += interest;
            pos.lastAccruedAt = block.timestamp;
        }
    }

    function getCollateralValue(address borrower) public view returns (uint256 valueInUSDG) {
        uint256 shares = positions[borrower].pledgedShares;
        if (shares == 0) return 0;
        valueInUSDG = IStonkWell(collateralWell).convertToAssets(shares);
    }

    function getCurrentDebt(address borrower) public view returns (uint256) {
        Position storage pos = positions[borrower];
        if (pos.principal == 0) return 0;
        uint256 elapsed = block.timestamp - pos.lastAccruedAt;
        uint256 interest = (pos.principal * baseAprBps * elapsed) / (BPS_DENOMINATOR * SECONDS_PER_YEAR);
        return pos.principal + interest;
    }

    function pledgeCollateral(uint256 shares) external {
        require(shares > 0, "ZERO_SHARES");
        Position storage pos = positions[msg.sender];
        _accrueInterest(pos);

        require(IERC20(collateralWell).transferFrom(msg.sender, address(this), shares), "PULL_SHARES_FAIL");
        pos.pledgedShares += shares;
        totalPledgedShares += shares;

        emit CollateralPledged(msg.sender, shares);
    }

    function withdrawCollateral(uint256 shares) external {
        require(shares > 0, "ZERO_SHARES");
        Position storage pos = positions[msg.sender];
        require(pos.pledgedShares >= shares, "EXCEEDS_PLEDGED");
        _accrueInterest(pos);

        pos.pledgedShares -= shares;
        totalPledgedShares -= shares;

        // Check health factor after withdrawal
        if (pos.principal > 0) {
            uint256 remainingValue = getCollateralValue(msg.sender);
            uint256 maxBorrowable = (remainingValue * MAX_LTV_BPS) / BPS_DENOMINATOR;
            require(pos.principal <= maxBorrowable, "EXCEEDS_MAX_LTV");
        }

        require(IERC20(collateralWell).transfer(msg.sender, shares), "TRANSFER_SHARES_FAIL");
        emit CollateralWithdrawn(msg.sender, shares);
    }

    function borrow(uint256 amount) external {
        require(amount > 0, "ZERO_AMOUNT");
        Position storage pos = positions[msg.sender];
        _accrueInterest(pos);

        uint256 collateralVal = getCollateralValue(msg.sender);
        uint256 maxBorrowable = (collateralVal * MAX_LTV_BPS) / BPS_DENOMINATOR;
        require(pos.principal + amount <= maxBorrowable, "EXCEEDS_MAX_LTV");

        pos.principal += amount;
        totalBorrowed += amount;

        require(IERC20(asset).balanceOf(address(this)) >= amount, "INSUFFICIENT_LIQUIDITY");
        require(IERC20(asset).transfer(msg.sender, amount), "TRANSFER_CREDIT_FAIL");

        emit CreditBorrowed(msg.sender, amount);
    }

    function repay(uint256 amount) external {
        require(amount > 0, "ZERO_AMOUNT");
        Position storage pos = positions[msg.sender];
        _accrueInterest(pos);

        uint256 toRepay = amount > pos.principal ? pos.principal : amount;
        require(toRepay > 0, "NO_DEBT");

        require(IERC20(asset).transferFrom(msg.sender, address(this), toRepay), "PULL_REPAY_FAIL");
        pos.principal -= toRepay;
        totalBorrowed -= toRepay;

        emit CreditRepaid(msg.sender, toRepay);
    }

    function liquidate(address borrower, uint256 repayAmount) external {
        Position storage pos = positions[borrower];
        _accrueInterest(pos);

        uint256 currentDebt = pos.principal;
        require(currentDebt > 0, "NO_DEBT");

        uint256 collateralVal = getCollateralValue(borrower);
        uint256 liquidationValue = (collateralVal * LIQUIDATION_THRESHOLD_BPS) / BPS_DENOMINATOR;
        require(currentDebt > liquidationValue, "POSITION_HEALTHY");

        uint256 maxRepay = currentDebt / 2; // Up to 50% close factor
        uint256 actualRepay = repayAmount > maxRepay ? maxRepay : repayAmount;

        // Seize collateral + 5% incentive
        uint256 seizeValue = (actualRepay * (BPS_DENOMINATOR + LIQUIDATION_INCENTIVE_BPS)) / BPS_DENOMINATOR;
        uint256 sharePrice = IStonkWell(collateralWell).convertToAssets(1e18);
        uint256 sharesToSeize = (seizeValue * 1e18) / sharePrice;

        if (sharesToSeize > pos.pledgedShares) {
            sharesToSeize = pos.pledgedShares;
        }

        require(IERC20(asset).transferFrom(msg.sender, address(this), actualRepay), "PULL_REPAY_FAIL");
        pos.principal -= actualRepay;
        totalBorrowed -= actualRepay;

        pos.pledgedShares -= sharesToSeize;
        totalPledgedShares -= sharesToSeize;

        require(IERC20(collateralWell).transfer(msg.sender, sharesToSeize), "TRANSFER_SEIZED_FAIL");

        emit Liquidated(borrower, msg.sender, actualRepay, sharesToSeize);
    }
}
