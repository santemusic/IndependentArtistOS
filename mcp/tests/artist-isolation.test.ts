import { test } from "node:test";
import assert from "node:assert/strict";
import { allowedArtistsForOwner, assertArtistAllowed } from "../src/adapters/shared-notion.js";
const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
test("ACL is bound to both workspace and OAuth owner", () => {
  const acl = JSON.stringify({ "workspace:userA": [a], "workspace:userB": [b] });
  assert.deepEqual(allowedArtistsForOwner("userA", "workspace", acl), [a]);
  assert.throws(() => allowedArtistsForOwner("userA", "other", acl));
  assert.throws(() => allowedArtistsForOwner("userC", "workspace", acl));
});
test("cross-artist IDs fail closed", () => {
  assert.doesNotThrow(() => assertArtistAllowed(a, [a]));
  assert.throws(() => assertArtistAllowed(b, [a]), /denied/);
  assert.throws(() => assertArtistAllowed("", [a]), /denied/);
});
test("invalid or missing ACL fails closed", () => {
  assert.throws(() => allowedArtistsForOwner("x", "w", ""));
  assert.throws(() => allowedArtistsForOwner("x", "w", "{"));
  assert.throws(() => allowedArtistsForOwner("x", "w", JSON.stringify({"w:x": ["not-an-id"]})));
});
