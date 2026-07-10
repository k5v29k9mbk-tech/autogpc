// US military duty stations, used to pre-answer the US Bank "Final Delivery
// Location Outside United States?" order field. The signup form collects the
// cardholder's home station; `oconus` then seeds that dropdown on Review.
//
// `oconus` = final delivery lands off US soil (foreign country OR a US
// territory that ships via APO/FPO / customs like Guam). The 50 states + DC
// are CONUS (false). It's only a *default* the reviewer confirms, so the
// territory judgement call (Guam et al. are legally US but OCONUS for
// logistics/VAT/APO purposes) is safe to make here.
// ponytail: representative major-installation list, not literally every base;
// extend the array when a station is missing rather than reworking anything.

export type DutyStation = {
  id: string;
  name: string;
  /** Grouping label for the signup <optgroup> (country, or "United States"). */
  country: string;
  oconus: boolean;
};

const CONUS = (id: string, name: string): DutyStation => ({
  id,
  name,
  country: "United States",
  oconus: false,
});

const OCONUS = (id: string, name: string, country: string): DutyStation => ({
  id,
  name,
  country,
  oconus: true,
});

export const DUTY_STATIONS: DutyStation[] = [
  // --- CONUS + Alaska/Hawaii (US states → not outside the US) ---------------
  CONUS("fort-liberty", "Fort Liberty (Bragg), NC — Army"),
  CONUS("fort-cavazos", "Fort Cavazos (Hood), TX — Army"),
  CONUS("fort-moore", "Fort Moore (Benning), GA — Army"),
  CONUS("fort-campbell", "Fort Campbell, KY — Army"),
  CONUS("fort-bliss", "Fort Bliss, TX — Army"),
  CONUS("fort-stewart", "Fort Stewart, GA — Army"),
  CONUS("fort-carson", "Fort Carson, CO — Army"),
  CONUS("fort-drum", "Fort Drum, NY — Army"),
  CONUS("fort-riley", "Fort Riley, KS — Army"),
  CONUS("fort-johnson", "Fort Johnson (Polk), LA — Army"),
  CONUS("fort-sill", "Fort Sill, OK — Army"),
  CONUS("fort-gregg-adams", "Fort Gregg-Adams (Lee), VA — Army"),
  CONUS("fort-belvoir", "Fort Belvoir, VA — Army"),
  CONUS("fort-knox", "Fort Knox, KY — Army"),
  CONUS("fort-eisenhower", "Fort Eisenhower (Gordon), GA — Army"),
  CONUS("fort-leonard-wood", "Fort Leonard Wood, MO — Army"),
  CONUS("fort-irwin", "Fort Irwin, CA — Army"),
  CONUS("fort-meade", "Fort Meade, MD — Army"),
  CONUS("fort-novosel", "Fort Novosel (Rucker), AL — Army"),
  CONUS("fort-jackson", "Fort Jackson, SC — Army"),
  CONUS("fort-leavenworth", "Fort Leavenworth, KS — Army"),
  CONUS("jblm", "Joint Base Lewis-McChord, WA — Army/AF"),
  CONUS("wright-patterson", "Wright-Patterson AFB, OH — Air Force"),
  CONUS("nellis", "Nellis AFB, NV — Air Force"),
  CONUS("eglin", "Eglin AFB, FL — Air Force"),
  CONUS("travis", "Travis AFB, CA — Air Force"),
  CONUS("jbsa", "Joint Base San Antonio, TX — Air Force"),
  CONUS("scott", "Scott AFB, IL — Air Force"),
  CONUS("tinker", "Tinker AFB, OK — Air Force"),
  CONUS("hill", "Hill AFB, UT — Air Force"),
  CONUS("davis-monthan", "Davis-Monthan AFB, AZ — Air Force"),
  CONUS("luke", "Luke AFB, AZ — Air Force"),
  CONUS("offutt", "Offutt AFB, NE — Air Force"),
  CONUS("jb-langley-eustis", "Joint Base Langley-Eustis, VA — Air Force"),
  CONUS("barksdale", "Barksdale AFB, LA — Air Force"),
  CONUS("minot", "Minot AFB, ND — Air Force"),
  CONUS("jb-andrews", "Joint Base Andrews, MD — Air Force"),
  CONUS("peterson", "Peterson SFB, CO — Space Force"),
  CONUS("buckley", "Buckley SFB, CO — Space Force"),
  CONUS("vandenberg", "Vandenberg SFB, CA — Space Force"),
  CONUS("ns-norfolk", "Naval Station Norfolk, VA — Navy"),
  CONUS("nb-san-diego", "Naval Base San Diego, CA — Navy"),
  CONUS("ns-mayport", "Naval Station Mayport, FL — Navy"),
  CONUS("nb-kitsap", "Naval Base Kitsap, WA — Navy"),
  CONUS("ns-great-lakes", "Naval Station Great Lakes, IL — Navy"),
  CONUS("nas-pensacola", "Naval Air Station Pensacola, FL — Navy"),
  CONUS("nbvc", "Naval Base Ventura County, CA — Navy"),
  CONUS("ns-everett", "Naval Station Everett, WA — Navy"),
  CONUS("camp-pendleton", "MCB Camp Pendleton, CA — Marines"),
  CONUS("camp-lejeune", "MCB Camp Lejeune, NC — Marines"),
  CONUS("quantico", "MCB Quantico, VA — Marines"),
  CONUS("miramar", "MCAS Miramar, CA — Marines"),
  CONUS("twentynine-palms", "MCAGCC Twentynine Palms, CA — Marines"),
  CONUS("parris-island", "MCRD Parris Island, SC — Marines"),
  CONUS("uscga", "USCG Academy New London, CT — Coast Guard"),
  CONUS("cg-base-alameda", "USCG Base Alameda, CA — Coast Guard"),
  CONUS("jber", "Joint Base Elmendorf-Richardson, AK — Air Force"),
  CONUS("fort-wainwright", "Fort Wainwright, AK — Army"),
  CONUS("eielson", "Eielson AFB, AK — Air Force"),
  CONUS("jbphh", "Joint Base Pearl Harbor-Hickam, HI — Navy/AF"),
  CONUS("schofield", "Schofield Barracks, HI — Army"),
  CONUS("mcb-hawaii", "MCB Hawaii (Kaneohe Bay), HI — Marines"),

  // --- Germany --------------------------------------------------------------
  OCONUS("ramstein", "Ramstein AB — Air Force", "Germany"),
  OCONUS("spangdahlem", "Spangdahlem AB — Air Force", "Germany"),
  OCONUS("usag-rp", "USAG Rheinland-Pfalz (Kaiserslautern) — Army", "Germany"),
  OCONUS("usag-wiesbaden", "USAG Wiesbaden — Army", "Germany"),
  OCONUS("usag-stuttgart", "USAG Stuttgart — Army", "Germany"),
  OCONUS("usag-ansbach", "USAG Ansbach — Army", "Germany"),
  OCONUS("usag-bavaria", "USAG Bavaria (Grafenwöhr/Vilseck/Hohenfels) — Army", "Germany"),
  OCONUS("usag-baumholder", "USAG Baumholder — Army", "Germany"),
  OCONUS("landstuhl", "Landstuhl Regional Medical Center — Army", "Germany"),

  // --- Italy ----------------------------------------------------------------
  OCONUS("aviano", "Aviano AB — Air Force", "Italy"),
  OCONUS("nas-sigonella", "NAS Sigonella — Navy", "Italy"),
  OCONUS("usag-italy", "USAG Italy (Caserma Ederle, Vicenza) — Army", "Italy"),
  OCONUS("camp-darby", "Camp Darby (Livorno) — Army", "Italy"),
  OCONUS("nsa-naples", "Naval Support Activity Naples — Navy", "Italy"),

  // --- United Kingdom -------------------------------------------------------
  OCONUS("raf-lakenheath", "RAF Lakenheath — Air Force", "United Kingdom"),
  OCONUS("raf-mildenhall", "RAF Mildenhall — Air Force", "United Kingdom"),
  OCONUS("raf-alconbury", "RAF Alconbury — Air Force", "United Kingdom"),
  OCONUS("raf-croughton", "RAF Croughton — Air Force", "United Kingdom"),
  OCONUS("raf-menwith-hill", "RAF Menwith Hill — Air Force", "United Kingdom"),

  // --- Rest of Europe -------------------------------------------------------
  OCONUS("ns-rota", "Naval Station Rota — Navy", "Spain"),
  OCONUS("moron", "Morón AB — Air Force", "Spain"),
  OCONUS("usag-benelux", "USAG Benelux (Chièvres / SHAPE) — Army", "Belgium"),
  OCONUS("usag-brunssum", "USAG Brunssum — Army", "Netherlands"),
  OCONUS("incirlik", "Incirlik AB — Air Force", "Turkey"),
  OCONUS("nsa-souda-bay", "NSA Souda Bay — Navy", "Greece"),
  OCONUS("lajes", "Lajes Field (Azores) — Air Force", "Portugal"),

  // --- Japan ----------------------------------------------------------------
  OCONUS("yokota", "Yokota AB — Air Force", "Japan"),
  OCONUS("kadena", "Kadena AB (Okinawa) — Air Force", "Japan"),
  OCONUS("misawa", "Misawa AB — Air Force", "Japan"),
  OCONUS("yokosuka", "Fleet Activities Yokosuka — Navy", "Japan"),
  OCONUS("sasebo", "Fleet Activities Sasebo — Navy", "Japan"),
  OCONUS("camp-zama", "Camp Zama — Army", "Japan"),
  OCONUS("camp-butler", "MCB Camp Butler (Okinawa) — Marines", "Japan"),
  OCONUS("iwakuni", "MCAS Iwakuni — Marines", "Japan"),
  OCONUS("atsugi", "NAF Atsugi — Navy", "Japan"),

  // --- South Korea ----------------------------------------------------------
  OCONUS("humphreys", "USAG Humphreys (Camp Humphreys) — Army", "South Korea"),
  OCONUS("osan", "Osan AB — Air Force", "South Korea"),
  OCONUS("kunsan", "Kunsan AB — Air Force", "South Korea"),
  OCONUS("usag-daegu", "USAG Daegu (Camp Walker/Carroll) — Army", "South Korea"),
  OCONUS("usag-yongsan-casey", "USAG Yongsan-Casey — Army", "South Korea"),

  // --- US territories (OCONUS for APO/FPO & customs; reviewer confirms) -----
  OCONUS("andersen", "Andersen AFB — Air Force", "Guam"),
  OCONUS("nb-guam", "Naval Base Guam — Navy", "Guam"),
  OCONUS("fort-buchanan", "Fort Buchanan — Army", "Puerto Rico"),
];

const BY_ID = new Map(DUTY_STATIONS.map((s) => [s.id, s]));

export function findDutyStation(id: string | null | undefined): DutyStation | null {
  return id ? BY_ID.get(id) ?? null : null;
}
