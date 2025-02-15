import { v4 as uuid } from "uuid";
import { expect } from "chai";
import CacheEvent, { CACHE_EVENT_TYPES, TOKEN_TYPES, TOKEN_TYPE_KEY } from "../../src/telemetry/CacheEvent";

describe("CacheEvent", () => {
    it("constructs and carries exepcted values", () => {
        const correlationId = uuid();
        const event = new CacheEvent(CACHE_EVENT_TYPES.TokenCacheLookup, correlationId).get();
        expect(event["msal.event_name"]).to.eq(CACHE_EVENT_TYPES.TokenCacheLookup);
        expect(event["msal.elapsed_time"]).to.eq(-1);
    });

    it("sets values", () =>{
        const correlationId = uuid();
        const cacheEvent = new CacheEvent(CACHE_EVENT_TYPES.TokenCacheBeforeAccess, correlationId);

        cacheEvent.tokenType = TOKEN_TYPES.AT;

        const event = cacheEvent.get();

        expect(event[TOKEN_TYPE_KEY]).to.eq(TOKEN_TYPES.AT);
    });
});
