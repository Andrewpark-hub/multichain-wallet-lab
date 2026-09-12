// 실습 1 - Step 1: 니모닉 생성과 키 파생 (BIP-39 / BIP-32 / BIP-44)
// 엔트로피 -> 체크섬 -> 니모닉 -> 시드 -> 주소 순서를 직접 계산하고,
// 마지막에 라이브러리(bip39, ethers) 결과와 같은 값이 나오는지 대조한다.

const fs = require('fs');
const bip39 = require('bip39');
const { ethers } = require('ethers');
require('dotenv').config({ quiet: true });

// 교육용 고정 엔트로피(0으로만 채운 128비트). 실자산 지갑에는 절대 사용 금지.
const demo_entropy = '00000000000000000000000000000000';
const wordlist = bip39.wordlists.english;
const evm_path = "m/44'/60'/0'/0/0";

// 바이트 배열을 2진수 문자열로 (체크섬 비트를 눈으로 보기 위함)
function bytes_to_binary(bytes) {
    return Array.from(bytes).map(b => b.toString(2).padStart(8, '0')).join('');
}

function main() {
    console.log("========================================");
    console.log("실습 1 - Step 1: 니모닉 생성과 키 파생");
    console.log("========================================\n");

    // 1. 엔트로피 -> 체크섬 (SHA-256 해시의 앞 ENT/32 비트)
    const entropy = Buffer.from(demo_entropy, 'hex');
    const ent_bits = entropy.length * 8;
    const cs_bits = ent_bits / 32;
    const hash = ethers.sha256(entropy);
    const checksum = bytes_to_binary(ethers.getBytes(hash)).slice(0, cs_bits);

    console.log(`[*] 엔트로피 (${ent_bits}비트): ${entropy.toString('hex')}`);
    console.log(`[*] SHA-256 해시: ${hash}`);
    console.log(`[*] 체크섬 ${cs_bits}비트: ${checksum}`);

    // 2. (엔트로피 + 체크섬) 비트열을 11비트씩 잘라서 단어 인덱스로 변환
    const bits = bytes_to_binary(entropy) + checksum;
    const chunks = bits.match(/.{1,11}/g);
    const words = chunks.map(chunk => wordlist[parseInt(chunk, 2)]);

    console.log(`\n[*] 11비트 -> 단어 변환 (앞 3개, 마지막 1개만 출력)`);
    [0, 1, 2, chunks.length - 1].forEach(i => {
        console.log(`    ${String(i + 1).padStart(2)}번째: ${chunks[i]} -> ${String(parseInt(chunks[i], 2)).padStart(4)} -> ${words[i]}`);
    });

    // 3. 직접 만든 니모닉이 라이브러리 결과와 같은지 확인
    const mnemonic = words.join(' ');
    console.log(`\n[*] 니모닉 (${words.length}단어): ${mnemonic}`);
    console.log(`[*] bip39 라이브러리 결과와 일치: ${mnemonic === bip39.entropyToMnemonic(entropy)}`);
    console.log(`[*] 체크섬 검증(validateMnemonic): ${bip39.validateMnemonic(mnemonic)}`);

    // 4. 니모닉 -> 시드 (PBKDF2-HMAC-SHA512, 2048회 반복)
    const seed = bip39.mnemonicToSeedSync(mnemonic, '');
    const seed_with_pass = bip39.mnemonicToSeedSync(mnemonic, 'meetup-2026');

    console.log(`\n[*] 시드 (512비트): ${seed.toString('hex')}`);
    console.log(`[*] passphrase "meetup-2026" 사용 시: ${seed_with_pass.toString('hex')}`);
    console.log(`[*] 두 시드가 같은가: ${seed.equals(seed_with_pass)}`);
    console.log("    -> 니모닉이 같아도 passphrase가 다르면 완전히 다른 지갑이 된다.");

    // 5. BIP-32 마스터키 -> BIP-44 경로로 자식 키 파생
    // 경로 구조: m / purpose' / coin_type' / account' / change / address_index
    const master = ethers.HDNodeWallet.fromPhrase(mnemonic, '', "m");
    const account = ethers.HDNodeWallet.fromPhrase(mnemonic, '', evm_path);

    console.log(`\n[*] 마스터 공개키: ${master.publicKey}`);
    console.log(`[*] 파생 경로: ${evm_path}`);
    console.log(`[*] 개인키: ${account.privateKey}`);
    console.log(`[*] 공개키(압축, 33바이트): ${account.publicKey}`);

    // 6. 공개키 -> 주소 직접 계산 (uncompressed 공개키를 keccak256 한 뒤 마지막 20바이트)
    const uncompressed = new ethers.Wallet(account.privateKey).signingKey.publicKey;
    const keccak = ethers.keccak256('0x' + uncompressed.slice(4)); // 앞의 0x04 제거
    const my_address = ethers.getAddress('0x' + keccak.slice(-40));

    console.log(`\n[*] 공개키(비압축, 65바이트): ${uncompressed}`);
    console.log(`[*] keccak256 마지막 20바이트로 계산한 주소: ${my_address}`);
    console.log(`[*] ethers가 알려준 주소: ${account.address}`);
    console.log(`[*] 직접 계산한 주소와 일치: ${my_address === account.address}`);

    // 7. 다음 단계에서 쓸 주소 정보 저장
    // .env에 니모닉이 있으면 그 지갑을, 없으면 위 데모 지갑 주소를 저장한다.
    let owner = account.address;
    let source = '데모 니모닉';
    if (process.env.MNEMONIC) {
        owner = ethers.HDNodeWallet.fromPhrase(process.env.MNEMONIC.trim(), '', evm_path).address;
        source = '.env MNEMONIC';
    }

    fs.writeFileSync('shared_data.json', JSON.stringify({ path: evm_path, address: owner, source: source }, null, 2));
    console.log(`\n[성공] shared_data.json에 주소 정보가 저장되었습니다. (출처: ${source})`);
    console.log(`       주소: ${owner}`);
}

main();
