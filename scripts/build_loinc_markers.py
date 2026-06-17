#!/usr/bin/env python3
"""
Build a curated marker dictionary slice from the full LOINC release.

LOINC ships ~109k codes; importing them all would flood the prefix-matcher with
near-duplicate specimen/scale variants (e.g. 30+ "Complement C3" rows). This
script distils the release down to the commonly-ordered LAB tests:

  STATUS = ACTIVE              (drop deprecated)
  CLASSTYPE = 1                (lab tests only; drop clinical/survey/claims)
  COMMON_TEST_RANK in 1..N     (the "Top 2000" ranking, already inside Loinc.csv)
  SYSTEM in a report-realistic specimen whitelist
  one entry per analyte        (lowest COMMON_TEST_RANK wins -> serum over fluid)

Output: prisma/markers.loinc.json  (committable; ~hundreds–2000 entries)

This is a DEV-TIME tool, not app runtime. Re-run when bumping the LOINC version.

Usage:
  python scripts/build_loinc_markers.py --loinc <path-to-Loinc.csv> [--top 2000]
"""
import argparse, csv, json, re, sys
from collections import OrderedDict

# Specimens that actually appear on routine lab reports. Body-fluid / tissue
# variants share component names and only cause alias collisions, so we drop them.
SYSTEM_WHITELIST = {
    "ser/plas", "ser", "plas", "bld", "bld/plas", "rbc", "wbc",
    "urine", "urine sed", "ser/plas/bld", "bld.dot", "ser+plas",
}

# LOINC SCALE_TYP -> our valueType
SCALE_MAP = {
    "Qn": "numeric",
    "Ord": "ordinal", "SemiQn": "ordinal", "OrdQn": "ordinal",
    "Nom": "qualitative",
}

# LOINC CLASS -> friendlier category (fallback: the raw CLASS string)
CLASS_MAP = {
    "CHEM": "Chemistry", "HEM/BC": "Hematology", "UA": "Urinalysis",
    "SERO": "Serology / Immunology", "ENDO": "Endocrinology",
    "DRUG/TOX": "Drug / Toxicology", "MICRO": "Microbiology",
    "ABXBACT": "Microbiology", "COAG": "Coagulation", "ALLERGY": "Allergy",
    "LIPID": "Lipids", "MOLPATH": "Molecular", "TUMOR": "Tumor Markers",
    "FERT": "Fertility / Hormones", "BLDBK": "Blood Bank",
    "VACCIN": "Serology / Immunology", "CELLMARK": "Hematology",
}


def norm(s: str) -> str:
    """Match the app's normalise(): lowercase, keep a-z0-9.%/+- and space."""
    s = s.lower()
    s = re.sub(r"[^a-z0-9.%/+\- ]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def slug(s: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")
    return s[:48]


def strip_system(component: str) -> str:
    """'Complement C3^post dialysis' -> 'Complement C3'; drop trailing qualifiers."""
    return component.split("^")[0].strip()


# Encoded LOINC SHORTNAME/DisplayName fragments that never appear on a real
# report. Aliases containing these are dropped so the dictionary stays readable
# and the prefix-matcher isn't fed dead weight.
_ENCODED_TOKENS = (
    "-mcnc", "-scnc", "-acnc", "-ncnc", "-rto", "-rate", "-temp", "-srat",
    "mass/vol", "moles/vol", "/vol", "vol/vol", "imstn", "calculated",
    "serpl", "auto bld", "manual", "ql", "naa+probe",
)


def clean_alias(na: str) -> bool:
    """True if a normalised alias is human-meaningful (not a LOINC code string)."""
    if len(na) < 3:
        return False
    return not any(tok in na for tok in _ENCODED_TOKENS)


# Single-token aliases too generic to safely prefix-match a report row. LOINC's
# newer generic COMPONENTs ("Observation", bare "Platelet") would mis-fire, so a
# marker whose only alias is one of these is dropped rather than risk a false hit.
_GENERIC_DENY = {
    "observation", "platelet", "erythrocyte", "erythrocytes", "leukocytes",
    "blood", "cells", "cell", "fluid", "serum", "plasma", "urine", "ratio",
    "count", "volume", "mass", "number", "color", "colour", "appearance",
    "protein", "glucose", "presence", "identifier", "measurement",
}


def name_from_lcn(lcn: str, fallback: str) -> str:
    """A clean display name from LONG_COMMON_NAME.

    'MCV [Entitic mean volume] in Red Blood Cells by Automated count' -> 'MCV'
    'Complement C3 [Mass/volume] in Serum or Plasma'                  -> 'Complement C3'
    """
    if not lcn:
        return fallback
    name = lcn.split("[")[0].strip()
    # Trim a trailing specimen/method clause ("... in Serum or Plasma by ...").
    name = re.split(r"\b(?:in|of|by|to)\b", name, maxsplit=1)[0].strip()
    return name or fallback


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--loinc", required=True, help="path to LoincTable/Loinc.csv")
    ap.add_argument("--top", type=int, default=2000, help="max COMMON_TEST_RANK")
    ap.add_argument("--seed", default=None, help="path to prisma/seed.ts (to skip collisions)")
    ap.add_argument("--out", default=None, help="output json path")
    args = ap.parse_args()

    # Collect normalised aliases already owned by the hand-curated dictionary so
    # LOINC never shadows them (hand-curated have better India-specific aliases).
    reserved = set()
    if args.seed:
        try:
            seed_txt = open(args.seed, encoding="utf-8").read()
            for m in re.finditer(r"aliases:\s*\[([^\]]*)\]", seed_txt):
                for a in re.findall(r"'([^']*)'", m.group(1)):
                    reserved.add(norm(a))
            for m in re.finditer(r"markerKey:\s*'([^']+)'", seed_txt):
                reserved.add(norm(m.group(1)))
        except OSError:
            print(f"warn: could not read seed at {args.seed}", file=sys.stderr)

    rows = csv.DictReader(open(args.loinc, encoding="utf-8"))
    # analyte (normalised component) -> chosen row dict, keeping lowest rank
    best = {}
    for r in rows:
        if r["STATUS"] != "ACTIVE" or r["CLASSTYPE"] != "1":
            continue
        rank_s = r["COMMON_TEST_RANK"]
        if not rank_s or rank_s == "0":
            continue
        rank = int(rank_s)
        if rank > args.top:
            continue
        if norm(r["SYSTEM"]) not in SYSTEM_WHITELIST:
            continue
        scale = SCALE_MAP.get(r["SCALE_TYP"])
        if scale is None:
            continue
        comp = strip_system(r["COMPONENT"])
        key = norm(comp)
        if not key:
            continue
        prev = best.get(key)
        if prev is None or rank < prev["_rank"]:
            best[key] = {"_rank": rank, "_scale": scale, "row": r, "comp": comp}

    markers = []
    seen_keys = set()
    skipped_reserved = 0
    skipped_generic = 0
    for key, info in sorted(best.items(), key=lambda kv: kv[1]["_rank"]):
        r = info["row"]
        comp = info["comp"]
        # The clean display name comes from LONG_COMMON_NAME (COMPONENT is now
        # often a generic stub like "Observation"). CONSUMER_NAME / SHORTNAME add
        # extra aliases; most SHORTNAMEs are code strings and get filtered out.
        name = name_from_lcn(r["LONG_COMMON_NAME"], comp)
        # SHORTNAME / DisplayName are LOINC code strings ("PMV Bld Auto") that
        # never appear on a report, so only the human names seed the aliases.
        raw_aliases = [name, comp, r["CONSUMER_NAME"]]
        aliases = OrderedDict()
        for a in raw_aliases:
            if not a:
                continue
            na = norm(a)
            if clean_alias(na) and na not in _GENERIC_DENY:
                aliases[na] = True
        alias_list = list(aliases.keys())
        if not alias_list:
            skipped_generic += 1
            continue
        # If the hand-curated dictionary already owns the primary alias, skip the
        # whole LOINC entry so we never have two defs fighting over one name.
        if norm(name) in reserved:
            skipped_reserved += 1
            continue
        alias_list = [a for a in alias_list if a not in reserved]
        if not alias_list:
            skipped_reserved += 1
            continue

        marker_key = "lnc_" + slug(name)
        if marker_key in seen_keys:        # two analytes slugged to one key
            marker_key += "_" + r["LOINC_NUM"].split("-")[0]
        seen_keys.add(marker_key)

        unit = r["EXAMPLE_UCUM_UNITS"] or r["EXAMPLE_UNITS"] or None
        category = CLASS_MAP.get(r["CLASS"], r["CLASS"] or "Other")
        markers.append({
            "markerKey": marker_key,
            "canonicalName": name,
            "category": category,
            "aliases": alias_list,
            "defaultUnit": unit,
            "description": r["LONG_COMMON_NAME"] or name,
            "valueType": info["_scale"],
            "loincNum": r["LOINC_NUM"],
            "rank": info["_rank"],
        })

    out = args.out or "prisma/markers.loinc.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(markers, f, ensure_ascii=False, indent=1)
    print(f"wrote {len(markers)} markers to {out} (top={args.top}; "
          f"skipped {skipped_reserved} colliding with hand-curated, "
          f"{skipped_generic} too-generic)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
