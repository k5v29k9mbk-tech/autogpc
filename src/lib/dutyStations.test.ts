import { describe, expect, it } from "vitest";
import { DUTY_STATIONS, findDutyStation } from "./dutyStations";
import { finalDeliveryDefault } from "./usbankOrder";

describe("dutyStations", () => {
  it("has unique ids", () => {
    const ids = DUTY_STATIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps US states/territories CONUS and foreign bases OCONUS", () => {
    expect(findDutyStation("fort-liberty")?.oconus).toBe(false); // NC
    expect(findDutyStation("jber")?.oconus).toBe(false); // Alaska is a US state
    expect(findDutyStation("ramstein")?.oconus).toBe(true); // Germany
    expect(findDutyStation("andersen")?.oconus).toBe(true); // Guam → APO/FPO
  });

  it("maps the OCONUS flag onto the delivery-outside-US default", () => {
    expect(finalDeliveryDefault(false)).toBe("No");
    expect(finalDeliveryDefault(true)).toMatch(/^Yes/);
    expect(finalDeliveryDefault(null)).toBe("");
  });

  it("returns null for unknown ids", () => {
    expect(findDutyStation("nope")).toBeNull();
    expect(findDutyStation(null)).toBeNull();
  });
});
