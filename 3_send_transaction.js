// 실습 1 - Step 3: 트랜잭션 조립 -> 서명 -> 전송 -> 영수증
// 사전 검증(eth_call, estimateGas)을 먼저 하고, EIP-1559(Type 2) 트랜잭션을 만들어 로컬에서 서명한다.
//
// 기본값은 dry-run(서명까지만)이다. 실제로 네트워크에 보내려면 SEND_TX=true 를 붙여서 실행한다.
//   SEND_TX=true node 3_send_transaction.js

const { ethers } = require('ethers');
require('dotenv').config({ quiet: true });

const rpc_url = process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
const chain_id = 11155111;
const explorer = 'https://sepolia.etherscan.io';
const evm_path = "m/44'/60'/0'/0/0";
const send_tx = process.env.SEND_TX === 'true';

async function main() {
    console.log("========================================");
    console.log("실습 1 - Step 3: 트랜잭션 서명과 전송");
    console.log("========================================\n");

    if (!process.env.MNEMONIC) {
        console.log("[오류] .env 파일에 MNEMONIC을 넣어주세요. (테스트넷 전용 니모닉만 사용할 것)");
        return;
    }

    const provider = new ethers.JsonRpcProvider(rpc_url, chain_id);
    const wallet = ethers.HDNodeWallet.fromPhrase(process.env.MNEMONIC.trim(), '', evm_path).connect(provider);

    // 서명 직전에 지금 붙어 있는 RPC가 의도한 체인이 맞는지 확인한다.
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== chain_id) {
        console.log(`[오류] chainId 불일치: RPC는 ${network.chainId}, 기대값은 ${chain_id}`);
        return;
    }

    const to = process.env.TO_ADDRESS ? ethers.getAddress(process.env.TO_ADDRESS) : wallet.address;
    const amount = process.env.ETH_AMOUNT || '0.001';
    const value = ethers.parseEther(amount);
    const balance = await provider.getBalance(wallet.address);

    console.log(`[*] 보내는 주소: ${wallet.address}`);
    console.log(`[*] 받는 주소: ${to}${to === wallet.address ? ' (TO_ADDRESS 미지정 -> 자기 자신)' : ''}`);
    console.log(`[*] 전송 금액: ${amount} ETH`);
    console.log(`[*] 현재 잔고: ${ethers.formatEther(balance)} ETH`);

    // 1. 사전 검증 - 지금 보내면 성공하는지 가스를 쓰지 않고 먼저 확인한다.
    let gas_limit = 21000n;
    try {
        gas_limit = await provider.estimateGas({ from: wallet.address, to: to, value: value });
        console.log(`\n[*] estimateGas 성공: ${gas_limit}`);
    } catch (e) {
        // 잔고가 0이면 가스 추정부터 막힌다. 서명 구조는 볼 수 있게 표준값 21000으로 진행한다.
        console.log(`\n[!] estimateGas 실패 -> 21000으로 미리보기 진행 (${e.shortMessage || e.message})`);
    }

    // 2. EIP-1559(Type 2) 트랜잭션 객체 조립
    const nonce = await provider.getTransactionCount(wallet.address, 'pending');
    const fee = await provider.getFeeData();
    const tx = {
        type: 2,
        chainId: chain_id,
        nonce: nonce,
        to: to,
        value: value,
        gasLimit: gas_limit,
        maxFeePerGas: fee.maxFeePerGas,
        maxPriorityFeePerGas: fee.maxPriorityFeePerGas
    };

    console.log(`\n[*] nonce: ${nonce} (이 주소가 지금까지 보낸 트랜잭션 개수)`);
    console.log(`[*] maxFeePerGas: ${ethers.formatUnits(tx.maxFeePerGas, 'gwei')} gwei`);
    console.log(`[*] maxPriorityFeePerGas: ${ethers.formatUnits(tx.maxPriorityFeePerGas, 'gwei')} gwei`);
    console.log(`[*] 최대 수수료: ${ethers.formatEther(tx.maxFeePerGas * gas_limit)} ETH`);

    // 3. 로컬에서 서명 (개인키는 네트워크로 나가지 않는다)
    const raw_tx = await wallet.signTransaction(tx);
    console.log(`\n[*] 서명된 원본 트랜잭션: ${raw_tx.slice(0, 42)}...${raw_tx.slice(-16)}`);
    console.log(`[*] 트랜잭션 해시(서명값 기준): ${ethers.keccak256(raw_tx)}`);

    if (!send_tx) {
        console.log("\n[완료] dry-run 모드라 서명까지만 했습니다. 실제 전송은 SEND_TX=true 로 실행하세요.");
        return;
    }

    // 4. 브로드캐스트 -> 블록에 포함될 때까지 대기 -> 영수증 확인
    const response = await provider.broadcastTransaction(raw_tx);
    console.log(`\n[*] 전송됨. tx hash: ${response.hash}`);
    console.log("[*] 블록에 포함되기를 기다리는 중...");

    const receipt = await response.wait();
    console.log(`\n[*] 블록 번호: ${receipt.blockNumber}`);
    console.log(`[*] status: ${receipt.status === 1 ? '성공 (1)' : '실패 (0)'}`);
    console.log(`[*] 실제 사용한 가스: ${receipt.gasUsed}`);
    console.log(`[*] 실제 수수료: ${ethers.formatEther(receipt.gasUsed * receipt.gasPrice)} ETH`);
    console.log(`[*] 탐색기: ${explorer}/tx/${response.hash}`);
    console.log("\n[참고] 블록에 포함된 것과 성공한 것은 다르다. status가 1이어야 성공이다.");
}

main();
