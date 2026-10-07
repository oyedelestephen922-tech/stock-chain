// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title StonkFeeRouter
 * @notice Timelocked 70/30 fee distribution router.
 * Routes 70% of LP trading fees back into the StonkWell vault to compound shares,
 * and 30% to StonkDrawdownRetire for permanent buy-and-burn.
 */

interface IERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IStonkDrawdownRetire {
    function notifyFee(address token, uint256 amount) external;
}

contract StonkFeeRouter {
    address public owner;
    address public drawdownRetire;

    uint256 public wellShareBps = 7000;   // 70%
    uint256 public retireShareBps = 3000; // 30%
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant TIMELOCK_DURATION = 48 hours;

    struct ProposedSplit {
        uint256 wellShareBps;
        uint256 retireShareBps;
        uint256 eta;
        bool exists;
    }

    ProposedSplit public pendingSplit;

    event OwnerUpdated(address indexed prevOwner, address indexed newOwner);
    event DrawdownRetireUpdated(address indexed newTarget);
    event SplitProposed(uint256 wellShareBps, uint256 retireShareBps, uint256 eta);
    event SplitApplied(uint256 wellShareBps, uint256 retireShareBps);
    event FeesDistributed(
        address indexed token,
        address indexed well,
        uint256 totalAmount,
        uint256 wellAmount,
        uint256 retireAmount
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    constructor(address _drawdownRetire) {
        owner = msg.sender;
        drawdownRetire = _drawdownRetire;
        emit OwnerUpdated(address(0), msg.sender);
        if (_drawdownRetire != address(0)) {
            emit DrawdownRetireUpdated(_drawdownRetire);
        }
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "INVALID_OWNER");
        emit OwnerUpdated(owner, newOwner);
        owner = newOwner;
    }

    function setDrawdownRetire(address _newTarget) external onlyOwner {
        require(_newTarget != address(0), "INVALID_TARGET");
        drawdownRetire = _newTarget;
        emit DrawdownRetireUpdated(_newTarget);
    }

    function proposeSplit(uint256 _wellShareBps, uint256 _retireShareBps) external onlyOwner {
        require(_wellShareBps + _retireShareBps == BPS_DENOMINATOR, "INVALID_TOTAL_BPS");
        pendingSplit = ProposedSplit({
            wellShareBps: _wellShareBps,
            retireShareBps: _retireShareBps,
            eta: block.timestamp + TIMELOCK_DURATION,
            exists: true
        });
        emit SplitProposed(_wellShareBps, _retireShareBps, block.timestamp + TIMELOCK_DURATION);
    }

    function applySplit() external onlyOwner {
        require(pendingSplit.exists, "NO_PENDING_SPLIT");
        require(block.timestamp >= pendingSplit.eta, "TIMELOCK_PENDING");
        wellShareBps = pendingSplit.wellShareBps;
        retireShareBps = pendingSplit.retireShareBps;
        delete pendingSplit;
        emit SplitApplied(wellShareBps, retireShareBps);
    }

    /**
     * @notice Distributes fee tokens according to the 70/30 flywheel
     */
    function distributeFee(
        address token,
        address well,
        uint256 amount
    ) external returns (uint256 wellAmount, uint256 retireAmount) {
        require(amount > 0, "ZERO_AMOUNT");
        require(well != address(0), "INVALID_WELL");
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "PULL_FEE_FAILED");

        retireAmount = (amount * retireShareBps) / BPS_DENOMINATOR;
        wellAmount = amount - retireAmount;

        // Return 70% back to Well for compounding
        if (wellAmount > 0) {
            require(IERC20(token).transfer(well, wellAmount), "TRANSFER_WELL_FAILED");
        }

        // Send 30% to StonkDrawdownRetire for permanent buy-and-burn
        if (retireAmount > 0 && drawdownRetire != address(0)) {
            IERC20(token).approve(drawdownRetire, retireAmount);
            IStonkDrawdownRetire(drawdownRetire).notifyFee(token, retireAmount);
        }

        emit FeesDistributed(token, well, amount, wellAmount, retireAmount);
    }
}
