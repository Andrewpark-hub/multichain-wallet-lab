// 실습 1 - Step 5: ERC-20 승인(approve)과 회수
// approve는 '내 토큰을 다른 주소가 대신 옮길 수 있게' 권한을 주는 함수다.
// TOKEN_AMOUNT=0 으로 실행하면 그 권한을 회수(revoke)한다.
//
//   SPENDER_ADDRESS=0x... SEND_TX=true node 5_approve_token.js     # 1 USDC 승인
//   SPENDER_ADDRESS=0x... TOKEN_AMOUNT=0 SEND_TX=true node 5_approve_token.js   # 회수

const { ethers } = require('ethers');
require('dotenv').config({ quiet: true });

const rpc_url = process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
const chain_id = 11155111;
const explorer = 'https://sepolia.etherscan.io';
const token_address = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const evm_path = "m/44'/60'/0'/0/0";
const send_tx = process.env.SEND_TX === 'true';

const erc20_abi = [
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)'
];

async function main() {
    console.log("========================================");
    console.log("실습 1 - Step 5: 토큰 승인(approve)과 회수");
    console.log("========================================\n");

    if (!process.env.MNEMONIC) {
        console.log("[오류] .env 파일에 MNEMONIC을 넣어주세요.");
        return;
    }
    if (!process.env.SPENDER_ADDRESS) {
        console.log("[오류] SPENDER_ADDRESS를 지정해주세요. (권한을 줄 주소)");
        return;
    }

    const provider = new ethers.JsonRpcProvider(rpc_url, chain_id);
    const wallet = ethers.HDNodeWallet.fromPhrase(process.env.MNEMONIC.trim(), '', evm_path).connect(provider);
    const spender = ethers.getAddress(process.env.SPENDER_ADDRESS);
    const token = new ethers.Contract(token_address, erc20_abi, wallet);

    const symbol = await token.symbol();
    const decimals = await token.decimals();

    // 실습용이므로 무한 승인은 만들지 않는다. 필요한 수량만 숫자로 지정하게 했다.
    const amount = process.env.TOKEN_AMOUNT || '1';
    if (amount === 'max' || amount === 'unlimited') {
        console.log("[오류] 이 실습에서는 무한 승인을 만들지 않습니다. 숫자로 수량을 지정하세요.");
        return;
    }
    const parsed_amount = ethers.parseUnits(amount, decimals);

    // 1. 지금 이 spender에게 얼마나 권한이 열려 있는지 먼저 확인
    const before = await token.allowance(wallet.address, spender);
    console.log(`[*] owner: ${wallet.address}`);
    console.log(`[*] spender: ${spender}`);
    console.log(`[*] 토큰: ${token_address} (${symbol})`);
    console.log(`[*] 현재 allowance: ${ethers.formatUnits(before, decimals)} ${symbol}`);
    console.log(`[*] 설정할 금액: ${amount} ${symbol}${amount === '0' ? '  (권한 회수)' : ''}`);

    // 2. eth_call로 먼저 시뮬레이션해본다.
    // 실제로 보내지 않고 '지금 보내면 성공하는지'만 확인하는 거라 가스가 들지 않는다.
    try {
        await token.approve.staticCall(spender, parsed_amount);
        console.log("\n[*] staticCall(eth_call) 성공 - 지금 보내면 성공한다");
    } catch (e) {
        console.log(`\n[!] staticCall 실패 -> ${e.shortMessage || e.message}`);
        console.log("    이 상태로 보내면 가스만 쓰고 실패하므로 여기서 멈춘다.");
        return;
    }

    // 3. calldata 조립 + 가스 추정
    const populated = await token.approve.populateTransaction(spender, parsed_amount);
    let gas_limit = 60000n;
    try {
        gas_limit = await token.approve.estimateGas(spender, parsed_amount);
        console.log(`\n[*] estimateGas 성공: ${gas_limit}`);
    } catch (e) {
        console.log(`\n[!] estimateGas 실패 -> ${gas_limit}으로 진행 (${e.shortMessage || e.message})`);
    }
    console.log(`[*] 함수 셀렉터: ${populated.data.slice(0, 10)}  (approve(address,uint256))`);
    console.log(`[*] calldata: ${populated.data}`);

    // 4. 서명
    const nonce = await provider.getTransactionCount(wallet.address, 'pending');
    const fee = await provider.getFeeData();
    const raw_tx = await wallet.signTransaction({
        type: 2,
        chainId: chain_id,
        nonce: nonce,
        to: populated.to,
        data: populated.data,
        value: 0n,
        gasLimit: gas_limit,
        maxFeePerGas: fee.maxFeePerGas,
        maxPriorityFeePerGas: fee.maxPriorityFeePerGas
    });
    console.log(`\n[*] 서명 완료. 트랜잭션 해시: ${ethers.keccak256(raw_tx)}`);

    if (!send_tx) {
        console.log("\n[완료] dry-run 모드라 서명까지만 했습니다. 실제 승인은 SEND_TX=true 로 실행하세요.");
        return;
    }

    // 5. 전송 후 allowance가 실제로 바뀌었는지 다시 조회
    const response = await provider.broadcastTransaction(raw_tx);
    console.log(`\n[*] 전송됨. tx hash: ${response.hash}`);
    const receipt = await response.wait();
    console.log(`[*] status: ${receipt.status === 1 ? '성공 (1)' : '실패 (0)'}`);
    console.log(`[*] 탐색기: ${explorer}/tx/${response.hash}`);

    const after = await token.allowance(wallet.address, spender);
    console.log(`\n[*] 변경 후 allowance: ${ethers.formatUnits(after, decimals)} ${symbol}`);
    console.log("[참고] 이제 ./run.sh 6 으로 승인 내역이 감사에 잡히는지 확인해 보세요.");
}

main();
