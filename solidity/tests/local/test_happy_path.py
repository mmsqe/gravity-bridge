#!/usr/bin/python3

from conftest import *

def test_happy_path(signers):
    gravityId = bstring2bytes32(b"foo")
    valset0 = {
        "powers": examplePowers(),
        "validators": signers[:len(examplePowers())],
        "nonce": 0
    }
    powerThreshold = 6666
    gravity, testERC20, checkpoint = deployContracts(signers, gravityId, valset0["validators"], valset0["powers"], powerThreshold)

    powers = examplePowers()
    powers[0] -= 3
    powers[1] += 3
    validators = signers[:len(powers)]
    valset1 = {
        "powers": powers,
        "validators": validators,
        "nonce": 1
    }
    checkpoint1 = makeCheckpoint(getSignerAddresses(valset1["validators"]), valset1["powers"], valset1["nonce"], gravityId)
    sig1_v, sig1_r, sig1_s = signHash(valset0["validators"], checkpoint1)

    gravity.updateValset(getSignerAddresses(valset1["validators"]), valset1["powers"], valset1["nonce"], valset0["validators"], valset0["powers"], valset0["nonce"], sig1_v, sig1_r, sig1_s)

    assert gravity.state_lastValsetCheckpoint() == checkpoint1.hex()

    testERC20.approve(gravity, 1000)
    gravity.sendToCosmos(testERC20, bstring2bytes32(b"myCosmosAddress"), 1000)
    numTxs = 100
    txDestinationsInt = [signers[0]] * numTxs
    txFees = [0] * numTxs
    txAmounts = [0] * numTxs
    for i in range(numTxs):
        txFees[i] = 1
        txAmounts[i] = 1
        txDestinationsInt[i] = signers[i + 5]
    
    txDestinations = getSignerAddresses(txDestinationsInt)

    batchNonce = 1
    batchTimeout = 10000000
    methodName = bstring2bytes32(b"transactionBatch")
    abiEncoded = encode_abi(
        [
            "bytes32",
            "bytes32",
            "uint256[]",
            "address[]",
            "uint256[]",
            "uint256",
            "address",
            "uint256"
        ],
        [
            gravityId,
            methodName,
            txAmounts,
            txDestinations,
            txFees,
            batchNonce,
            testERC20.address,
            batchTimeout
        ]
    )
    digest = web3.keccak(abiEncoded)
    sig_v, sig_r, sig_s = signHash(valset1["validators"], digest)
    gravity.submitBatch(
        getSignerAddresses(valset1["validators"]),
        valset1["powers"],
        valset1["nonce"],
        sig_v,
        sig_r,
        sig_s,
        txAmounts,
        txDestinations,
        txFees,
        batchNonce,
        testERC20,
        batchTimeout
    )
    assert testERC20.balanceOf(signers[6].address) == 1
