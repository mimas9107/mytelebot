import test from "node:test";
import assert from "node:assert/strict";
import {
  getCommandMatchCandidates,
  getDeviceMatchCandidates,
  normalizeKey,
  rawTextExplicitlyMentionsDevice
} from "../apps/web/lib/registry-utils.mjs";

const device = {
  deviceKey: "light_01",
  name: "light",
  aliasesJson: JSON.stringify(["燈", "電燈", "客廳燈"])
};

const command = {
  commandKey: "lightcommands",
  label: "relay_set",
  aliasesJson: JSON.stringify(["打開", "關掉", "開燈", "關燈"])
};

test("device candidates include key name and aliases", () => {
  assert.deepEqual(getDeviceMatchCandidates(device), ["light_01", "light", "燈", "電燈", "客廳燈"]);
});

test("command candidates include key label and aliases", () => {
  assert.deepEqual(getCommandMatchCandidates(command), ["lightcommands", "relay_set", "打開", "關掉", "開燈", "關燈"]);
});

test("normalizeKey keeps unicode letters and removes separators", () => {
  assert.equal(normalizeKey("把 light_01 打開"), "把light01打開");
  assert.equal(normalizeKey("客廳燈-ON"), "客廳燈on");
});

test("raw text explicit mention matches aliases but rejects unrelated device names", () => {
  assert.equal(rawTextExplicitlyMentionsDevice("把燈打開", device), true);
  assert.equal(rawTextExplicitlyMentionsDevice("把客廳燈關掉", device), true);
  assert.equal(rawTextExplicitlyMentionsDevice("把風扇打開", device), false);
  assert.equal(rawTextExplicitlyMentionsDevice("打開它", device), false);
});
