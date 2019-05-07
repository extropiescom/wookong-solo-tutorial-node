const readline = require('readline');
const core = require('wookong-solo-lib');
const utils = require('./utils');
const Web3 = require('web3');
const { encode } = require('rlp');

const NODE_URL = 'https://mainnet.infura.io'; // https://mainnet-eth.token.im is also available

const web3 = new Web3(new Web3.providers.HttpProvider(NODE_URL));

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'WST> '
});

console.log('Welcome to WOOKONG Solo Tutorial Wallet(WST)!');
console.log('Welcome to WOOKONG Solo Tutorial Wallet(WST)!');
console.log('USAGE:');
console.log('info');
console.log('init (generate <seed_len>)|import');
console.log('foramt');
console.log('addr <derive_path>');
console.log('balance <derive_path>');
console.log('nsend (<derive_path> <to> <value>)');
console.log('Example');
console.log('init generate 32');
console.log('send [0,2147483692,2147483708,2147483648,0,0] 0x7F825230F5F2A26523999c98e0E3f7E2697085A9 0.00001');
rl.prompt();

rl.on('line', async (line) => {
    const command = line.trim().split(' ');
    try {
        switch (command[0]) {
            case 'info':
                await processGetDeviceInfo();
                break;
            case 'init':
                await processInit(command);
                break;
            case 'format':
                await processFormat(command);
                break;
            case 'addr':
                await processGetAddress(command);
                break;
            case 'balance':
                await processGetBalance(command);
                break;
            case 'send':
                await processSend(command);
                break;
            case 'exit':
                console.log('Thank you for using WST wallet, bye!');
                process.exit(0);
                break;
            default:
                console.log(`unknown command: '${command[0]}'`);
                break;
        }
    } catch (error) {
        console.log('An error happened: ', error.message);
    }
    rl.prompt();
}).on('close', () => {
    console.log('Thank you for using WST wallet, bye!');
    process.exit(0);
});

async function processGetDeviceInfo() {
    const info = await core.getDeviceInfo();
    if (info.code === core.constants.rets.SUCCESS ) {
        console.log(utils.parsePINState(info.result.ucPINState));
        console.log(utils.parseChainType(info.result.ucChainType));
        console.log(`device sn: ${info.result.pbSerialNumber}`);
        console.log(`device firmware version: ${info.result.pbCOSVersion.toString()}`, );
        console.log(utils.parseLifeCycle(info.result.ucLifeCycle));
        console.log(utils.parseLcdState(info.result.nLcdState));
    } else {
        console.log(`get device info failed: ${utils.parseReturnCode(info.code)} `);
    }
}

async function processInit(command) {
    const info = await core.getDeviceInfo();
    // check device is well connected and can be opened
    if (info.code !== core.constants.rets.SUCCESS) {
        console.log(`get device info failed: ${utils.parseReturnCode(info.code)} `);
        return;
    } else {
        // check device is able to init
        if (info.result.ucLifeCycle !== core.constants.devinfo.LIFECYCLE_AGREE) {
            console.log(`init failed: device lifecycle is ${utils.parseLifeCycle(info.result.ucLifeCycle)}`);
            return;
        }
    }
    let result ={};
    switch (command[1]) {
        case 'generate':
            result = await core.generateSeed(parseInt(command[2]));
            break;
        case 'import':
            result = await core.importSeed();
            break;
        default:
            console.log(`unknown parameter: ${command[1]} `);
            break;
    }
    if (result.code === core.constants.rets.SUCCESS) {
        console.log(`${command[1]} completed successfully`);
    } else {
        console.log(`${command[1]} failed: ${utils.parseReturnCode(result.code)} `);
    }
}

async function processFormat() {
    const info = await core.getDeviceInfo();
    // check device is well connected and can be opened
    if (info.code !== core.constants.rets.SUCCESS) {
        console.log(`get device info failed: ${utils.parseReturnCode(info.code)} `);
        return;
    }
    const result = await core.format();
    if (result.code === core.constants.rets.SUCCESS) {
        console.log(`format completed successfully`);
    } else {
        console.log(`format failed: ${utils.parseReturnCode(result.code)} `);
    }
}

async function processGetAddress(command) {
    const ready = await isDeviceReady();
    if (!ready) {
        return;
    }
    const derivePath = JSON.parse(command[1]);
    const result = await getAddress(derivePath, 1);
    if (result.code === core.constants.rets.SUCCESS) {
        console.log(`your ETH address is: ${result.result.address} `);
    } else {
        console.log(`get address failed: ${utils.parseReturnCode(result.code)} `);
    }
}

async function isDeviceReady() {
    const result = await core.getDeviceInfo();
    if (result.code !== core.constants.rets.SUCCESS) {
        console.log(`get device info failed: ${utils.parseReturnCode(result.code)} `);
        return false;
    } else {
        if (result.result.ucPINState !== core.constants.devinfo.PIN_LOGIN) {
            console.log(`Invalid PIN state, please unlock PIN first`);
            return false;
        } 
        if (result.result.nLcdState !== core.constants.devinfo.LCD_NULL && result.result.nLcdState !== core.constants.devinfo.LCD_SHOWLOGO) {
            console.log(`Invalid lcd state, please ensure LCD is showing WOOKONG first`);
            return false;
        }
        return true;
    }
}

async function getAddress(derivePath, showOnScreen) {
    const result = await core.getAddress(core.constants.coins.COIN_TYPE_ETH, derivePath, showOnScreen);
    return result;
}

async function processGetBalance(command) {
    const ready = await isDeviceReady();
    if (!ready) {
        return;
    }
    //get address
    const derivePath = JSON.parse(command[1]);
    const result = await getAddress(derivePath, 0);
    if (result.code !== core.constants.rets.SUCCESS) {
        console.log(`get address failed: ${utils.parseReturnCode(result.code)} `);
        return;
    }
    //get balance by address
    try {
        const balanceInWei = await web3.eth.getBalance(result.result.address);
        //balance is returned in Wei, so we need to transform to Ether
        const balanceInEther = web3.utils.fromWei(balanceInWei);
        console.log(`your ETH address is: ${result.result.address}, balance is: ${balanceInEther.toString()} Ether`);
    } catch (error) {
        console.log(`error: ${error.message}`);
        return;
    }
}

async function processSend(command) {
    const ready = await isDeviceReady();
    if (!ready) {
        return;
    }
    // we need address to get nonce
    const derivePath = JSON.parse(command[1]);
    const addressResult = await getAddress(derivePath, 0);
    if (addressResult.code !== core.constants.rets.SUCCESS) {
        console.log(`get address failed: ${utils.parseReturnCode(addressResult.code)}`);
        return;
    }
    try {
        // get nonce
        const nonce = web3.utils.toHex(await web3.eth.getTransactionCount(addressResult.result.address));
        // get gas price
        const gasPrice = await web3.eth.getGasPrice()
        const gasPriceHex = web3.utils.toHex(gasPrice);
        // gas limit for ETH transaction is fixed to 21000 in Ethereum Yellow Book
        const gasLimit = 21000;
        const gasLimitHex = web3.utils.toHex(gasLimit);
        const to = command[2];
        const value = web3.utils.toHex(await web3.utils.toWei(command[3]));
        // raw data to sign
        const dataToSign = [nonce, gasPriceHex, gasLimitHex, to, value, '','0x01', '0x', '0x'];
        // raw data to sign, rlp encoded
        const rawToSign = encode(dataToSign).toString('hex');
        // call WOOKONG Solo for signature
        const signResult = await core.signEthereum(derivePath, rawToSign, true);
        if (signResult.code !== core.constants.rets.SUCCESS) {
            console.log('ETH sign failed:', utils.parseReturnCode(signResult.code));
            return;
        }
        let v = '';
        if (signResult.result.sign.v === '0x00') {
            v = '0x25';
        } else {
            v = '0x26';
        }
        // signed raw data
        const dataSigned = [nonce, gasPriceHex, gasLimitHex, to, value, '', v, signResult.result.sign.r, signResult.result.sign.s];
        // signed raw data, rlp encoded
        const rawSigned = `0x${encode(dataSigned).toString('hex')}`;
        // broadcast transaction to blockchain
        const txid =  '0xf87849866f9ceffd2607179b096f1f6d7b41ceb2664272302cd359383afe1e78';// const txid =  await new Promise((resolve, reject) => { //const txid =  '0xf87849866f9ceffd2607179b096f1f6d7b41ceb2664272302cd359383afe1e78';
        //     web3.eth.sendSignedTransaction(rawSigned, (err, hash) => {
        //         if (err) {
        //             reject(err);
        //         } else {
        //             resolve(hash);
        //         }
        //     });
        // });
        console.log(`transaction succeeded.`);
        console.log(`from: ${addressResult.result.address}`);
        console.log(`to: ${command[2]}`);
        console.log(`value: ${command[3]} Ether`);
        console.log(`gas price: ${gasPrice} Wei`);
        console.log(`gas limit: ${gasLimit}`);
        console.log(`you can see your transaction detail here: https://etherscan.io/tx/${txid}`);
    } catch (error) {
        console.log(`error: ${error.message}`,);
        return;
    }
}