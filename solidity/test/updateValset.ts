import chai from "chai";
import { ethers} from "hardhat";
import { solidity } from "ethereum-waffle";

import { deployContracts } from "../test-utils";
import {
  getSignerAddresses,
  makeCheckpoint,
  signHash,
  makeTxBatchHash,
  examplePowers
} from "../test-utils/pure";

chai.use(solidity);
const { expect } = chai;

async function runTest(opts: {
  malformedNewValset?: boolean;
  malformedCurrentValset?: boolean;
  nonMatchingCurrentValset?: boolean;
  nonceNotIncremented?: boolean;
  badValidatorSig?: boolean;
  zeroedValidatorSig?: boolean;
  notEnoughPower?: boolean;
  badReward?: boolean;
  notEnoughReward?: boolean;
  withReward?: boolean;
  notEnoughPowerNewSet?: boolean;
  zeroLengthValset?: boolean;
}) {
  const signers = await ethers.getSigners();
  const gravityId = ethers.utils.formatBytes32String("foo");

  // This is the power distribution on the Cosmos hub as of 7/14/2020
  let powers = examplePowers();
  let validators = signers.slice(0, powers.length);

  const powerThreshold = 6666;

  const {
    gravity,
    testERC20,
    checkpoint: deployCheckpoint
  } = await deployContracts(gravityId, validators, powers, powerThreshold);

  let newPowers = examplePowers();
  newPowers[0] -= 3;
  newPowers[1] += 3;

  let newValidators = signers.slice(0, newPowers.length);
  if (opts.malformedNewValset) {
    // Validators and powers array don't match
    newValidators = signers.slice(0, newPowers.length - 1);
  } else if (opts.zeroLengthValset) {
    newValidators = [];
    newPowers = [];
  } else if (opts.notEnoughPowerNewSet) {
    for (let i in newPowers) {
      newPowers[i] = 5;
    }
  }

  let currentValsetNonce = 0;
  if (opts.nonMatchingCurrentValset) {
    powers[0] = 78;
  }
  let newValsetNonce = 1;
  if (opts.nonceNotIncremented) {
    newValsetNonce = 0;
  }

  const checkpoint = makeCheckpoint(
    await getSignerAddresses(newValidators),
    newPowers,
    newValsetNonce,
    gravityId
  );

  let sigs = await signHash(validators, checkpoint);
  if (opts.badValidatorSig) {
    // Switch the first sig for the second sig to screw things up
    sigs[1].v = sigs[0].v;
    sigs[1].r = sigs[0].r;
    sigs[1].s = sigs[0].s;
  }

  if (opts.zeroedValidatorSig) {
    // Switch the first sig for the second sig to screw things up
    sigs[1].v = sigs[0].v;
    sigs[1].r = sigs[0].r;
    sigs[1].s = sigs[0].s;
    // Then zero it out to skip evaluation
    sigs[1].v = 0;
  }

  if (opts.notEnoughPower) {
    // zero out enough signatures that we dip below the threshold
    sigs[1].v = 0;
    sigs[2].v = 0;
    sigs[3].v = 0;
    sigs[5].v = 0;
    sigs[6].v = 0;
    sigs[7].v = 0;
    sigs[9].v = 0;
    sigs[11].v = 0;
    sigs[13].v = 0;
  }

  if (opts.malformedCurrentValset) {
    // Remove one of the powers to make the length not match
    powers.pop();
  }

  await gravity.updateValset(
    await getSignerAddresses(newValidators),
    newPowers,
    newValsetNonce,
    await getSignerAddresses(validators),
    powers,
    currentValsetNonce,
    sigs
  );

  return { gravity, checkpoint };
}

describe("updateValset tests", function () {
  it("throws on malformed new valset", async function () {
    await expect(runTest({ malformedNewValset: true })).to.be.revertedWith(
      "MalformedNewValidatorSet()"
    );
  });

  it("throws on empty new valset", async function () {
    await expect(runTest({ zeroLengthValset: true })).to.be.revertedWith(
      "MalformedNewValidatorSet()"
    );
  });

  it("throws on malformed current valset", async function () {
    await expect(runTest({ malformedCurrentValset: true })).to.be.revertedWith(
      "MalformedCurrentValidatorSet()"
    );
  });

  it("throws on non matching checkpoint for current valset", async function () {
    await expect(
      runTest({ nonMatchingCurrentValset: true })
    ).to.be.revertedWith(
      "IncorrectCheckpoint()"
    );
  });

  it("throws on new valset nonce not incremented", async function () {
    await expect(runTest({ nonceNotIncremented: true })).to.be.revertedWith(
      "InvalidValsetNonce(0, 0)"
    );
  });

  it("throws on bad validator sig", async function () {
    await expect(runTest({ badValidatorSig: true })).to.be.revertedWith(
      "InvalidSignature()"
    );
  });

  it("allows zeroed sig", async function () {
    await runTest({ zeroedValidatorSig: true });
  });

  it("throws on not enough signatures", async function () {
    await expect(runTest({ notEnoughPower: true })).to.be.revertedWith(
      "InsufficientPower(2807621889, 2863311530)"
    );
  });

  it("throws on not enough power in new set", async function () {
    await expect(runTest({ notEnoughPowerNewSet: true })).to.be.revertedWith(
      "InsufficientPower(625, 2863311530)"
    );
  });

  it("happy path", async function () {
    let { gravity, checkpoint } = await runTest({});
    expect((await gravity.functions.state_lastValsetCheckpoint())[0]).to.equal(checkpoint);
  });
});
