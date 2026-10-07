// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title StonkDrawdownRetire
 * @notice Permanent buy-and-burn mechanism for the community token ($GET / Ponds token).
 * Receives USDG fee shares from StonkFeeRouter, swaps for community tokens on Uniswap v3,
 * and permanently sends them to 0x...dEaD.
 */

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

contract StonkDrawdownRetire {
    address public owner;
    address public communityToken;
    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    
    uint256 public totalBurned;

    event OwnerUpdated(address indexed prevOwner, address indexed newOwner);
    event CommunityTokenUpdated(address indexed token);
    event TokensBurned(address indexed token, uint256 amount);
    event FeeReceived(address indexed from, address indexed token, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    constructor(address _token) {
        owner = msg.sender;
        communityToken = _token;
        emit OwnerUpdated(address(0), msg.sender);
        if (_token != address(0)) {
            emit CommunityTokenUpdated(_token);
        }
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "INVALID_OWNER");
        emit OwnerUpdated(owner, newOwner);
        owner = newOwner;
    }

    function setCommunityToken(address _token) external onlyOwner {
        require(_token != address(0), "INVALID_TOKEN");
        communityToken = _token;
        emit CommunityTokenUpdated(_token);
    }

    /**
     * @notice Allows StonkFeeRouter or any source to forward USDG or other tokens
     */
    function notifyFee(address token, uint256 amount) external {
        require(amount > 0, "ZERO_AMOUNT");
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "TRANSFER_FAILED");
        emit FeeReceived(msg.sender, token, amount);
    }

    /**
     * @notice Burns any community tokens directly held by this contract
     */
    function burnCommunityTokens() external returns (uint256 amount) {
        require(communityToken != address(0), "NO_TOKEN_SET");
        amount = IERC20(communityToken).balanceOf(address(this));
        require(amount > 0, "NO_BALANCE");
        require(IERC20(communityToken).transfer(DEAD_ADDRESS, amount), "BURN_FAILED");
        totalBurned += amount;
        emit TokensBurned(communityToken, amount);
    }

    /**
     * @notice Emergency or administrative withdrawal of non-burned tokens if needed
     */
    function withdrawToken(address token, address recipient, uint256 amount) external onlyOwner {
        require(recipient != address(0), "INVALID_RECIPIENT");
        require(IERC20(token).transfer(recipient, amount), "WITHDRAW_FAILED");
    }
}
