import { expect } from "chai";
import { apiGet } from "../../client/httpclient.js";

describe("Smoke: GET /_api/trend/opportunities", function () {
  it("should return 200 and JSON body", async function () {
    const res = await apiGet("/_api/trend/opportunities?tf=H1&symbols=XAUUSD");

    expect(res.status).to.equal(200);
    expect(res.data).to.be.an("object");
    expect(res.data).to.have.property("ok");
  });
});
