import { describe, expect, it } from "vitest";
import fda from "./__fixtures__/openfda-otc-ingredient-names.json";
import { normalizeIngredient } from "./ingredients";

describe("normalizeIngredient", () => {
  it.each([
    ["Acetaminophen", "acetaminophen"],
    ["Paracetamol", "acetaminophen"],
    ["APAP", "acetaminophen"],
    ["Acetaminophen 325 mg", "acetaminophen"],
    ["Acetaminophen (in each 5 mL) 160 mg", "acetaminophen"],
    ["acetaminophen USP", "acetaminophen"],
    ["Dextromethorphan HBr 10 mg", "dextromethorphan"],
    ["Doxylamine succinate 6.25 mg", "doxylamine"],
    ["Phenylephrine HCl", "phenylephrine"],
  ])("%s → %s", (raw, expected) => {
    expect(normalizeIngredient(raw)).toBe(expected);
  });

  it("keeps unknown ingredients readable instead of guessing", () => {
    expect(normalizeIngredient("  Zinc Gluconate ")).toBe("zinc gluconate");
  });
});

describe("normalizeIngredient — salts, esters and spellings of one active moiety", () => {
  it.each([
    // Pain and fever
    ["Naproxen sodium 220 mg (naproxen 200 mg)", "naproxen"],
    ["NAPROXEN SODIUM", "naproxen"],
    ["Naproxen sodium USP", "naproxen"],
    ["Ibuprofen sodium", "ibuprofen"],
    ["Ibuprofen 200 mg (provided as ibuprofen sodium 256 mg)", "ibuprofen"],
    ["Ibuprofen potassium", "ibuprofen"],
    ["Solubilized ibuprofen", "ibuprofen"],
    ["Ibuprofen Tablet USP 200 mg", "ibuprofen"],
    ["Acetylsalicylic acid", "aspirin"],
    ["Aspirin USP 81 mg", "aspirin"],
    ["Acetaminophen (APAP) 500 mg", "acetaminophen"],
    ["Acetaminophen, USP 250 mg", "acetaminophen"],
    // Cough, cold and decongestants
    ["Dextromethorphan hydrobromide USP 30 mg", "dextromethorphan"],
    ["Dextromethorphan HBr, USP 20 mg", "dextromethorphan"],
    ["DEXTROMETHORPHAN HYDROCHLORIDE", "dextromethorphan"],
    ["Dextromethorphan polistirex equivalent to 30 mg", "dextromethorphan"],
    ["Guaifenesin USP 600 mg", "guaifenesin"],
    ["Guaiphenesin", "guaifenesin"],
    ["Pseudoephedrine HCl 30 mg", "pseudoephedrine"],
    ["Pseudoephedrine hydrochloride USP 240 mg", "pseudoephedrine"],
    ["Pseudoephedrine sulfate 120 mg", "pseudoephedrine"],
    ["PSEUDOEPHEDRINE SULFATE", "pseudoephedrine"],
    ["Phenylephrine bitartrate 7.8 mg", "phenylephrine"],
    ["Phenylephrine hydrochloride", "phenylephrine"],
    ["Ephedrine sulfate 25 mg", "ephedrine"],
    ["EPHEDRINE HYDROCHLORIDE", "ephedrine"],
    ["Codeine phosphate USP 10 mg", "codeine"],
    ["Chlophedianol HCl 12.5 mg", "chlophedianol"],
    ["Pentoxyverine citrate", "pentoxyverine"],
    ["Carbetapentane citrate", "pentoxyverine"],
    // Antihistamines
    ["Diphenhydramine citrate 38 mg", "diphenhydramine"],
    ["Diphenhydramine Hydrochloride USP 25 mg", "diphenhydramine"],
    ["Doxylamine succinate, USP 12.5 mg", "doxylamine"],
    ["Cetirizine HCl 10 mg", "cetirizine"],
    ["Cetirizine hydrochloride, USP 5 mg", "cetirizine"],
    ["Levocetirizine dihydrochloride USP 5 mg", "levocetirizine"],
    ["Loratadine USP 10 mg", "loratadine"],
    ["Fexofenadine HCl 180 mg", "fexofenadine"],
    ["Fexofenadine hydrochloride USP 180 mg", "fexofenadine"],
    ["Chlorpheniramine maleate 4 mg", "chlorpheniramine"],
    ["Chlorphenamine maleate", "chlorpheniramine"],
    ["Dexchlorpheniramine maleate 1 mg", "dexchlorpheniramine"],
    ["Brompheniramine maleate, USP 2 mg", "brompheniramine"],
    ["Dexbrompheniramine maleate 1 mg", "dexbrompheniramine"],
    ["Pheniramine maleate", "pheniramine"],
    ["Pyrilamine maleate 15 mg", "pyrilamine"],
    ["Mepyramine maleate", "pyrilamine"],
    ["Triprolidine HCl 2.5 mg", "triprolidine"],
    ["Chlorcyclizine hydrochloride", "chlorcyclizine"],
    ["Meclizine HCl 25 mg", "meclizine"],
    ["MECLIZINE DIHYDROCHLORIDE", "meclizine"],
    ["Meclozine", "meclizine"],
    // Stomach and bowel
    ["Famotidine USP 20 mg", "famotidine"],
    ["Cimetidine 200 mg", "cimetidine"],
    ["Ranitidine hydrochloride", "ranitidine"],
    ["Omeprazole magnesium", "omeprazole"],
    ["Omeprazole delayed-release tablet 20 mg (equivalent to 20.6 mg omeprazole magnesium)", "omeprazole"],
    ["Omeprazole, USP delayed-release tablet 20 mg", "omeprazole"],
    ["Esomeprazole magnesium", "esomeprazole"],
    ["Esomeprazole magnesium trihydrate", "esomeprazole"],
    ["ESOMEPRAZOLE MAGNESIUM DIHYDRATE", "esomeprazole"],
    ["Lansoprazole USP 15 mg", "lansoprazole"],
    ["Loperamide HCl 2 mg", "loperamide"],
    ["Loperamide hydrochloride USP 2 mg", "loperamide"],
    ["Bisacodyl USP 5 mg", "bisacodyl"],
    ["Sennosides 8.6 mg", "sennosides"],
    ["Sennosides from Senna Concentrate 8.6 mg", "sennosides"],
    ["SENNOSIDES A AND B", "sennosides"],
    ["Psyllium husk approximately 3.4 g", "psyllium"],
    ["Psyllium seed husk 3.4 g", "psyllium"],
    ["Psyllium hydrophilic mucilloid", "psyllium"],
    ["Simethicone 125 mg", "simethicone"],
    ["DIMETHICONE", "simethicone"], // FDA's NDC name for oral simethicone
    ["DIMETHICONE, UNSPECIFIED", "simethicone"],
    ["Activated dimethicone", "simethicone"],
    ["Dioctyl sodium sulfosuccinate", "docusate sodium"],
    ["Docusate Sodium USP 100 mg", "docusate sodium"],
    ["Pyrantel pamoate USP 180 mg", "pyrantel"],
    // Other
    ["Phenazopyridine hydrochloride 99.5 mg", "phenazopyridine"],
    ["Dyclonine hydrochloride 3 mg", "dyclonine"],
    ["Nicotine polacrilex USP 4 mg", "nicotine"],
    ["Nicotine 21 mg", "nicotine"],
    ["MENTHOL, UNSPECIFIED FORM", "menthol"],
    ["Magnesium sulfate heptahydrate", "magnesium sulfate"],
    ["Magnesium salicylate tetrahydrate 580 mg", "magnesium salicylate"],
    ["Anhydrous citric acid 1000 mg", "citric acid"],
    ["Citric acid monohydrate", "citric acid"],
    ["Pyridoxine hydrochloride", "pyridoxine"],
  ])("%s → %s", (raw, expected) => {
    expect(normalizeIngredient(raw)).toBe(expected);
  });
});

describe("normalizeIngredient — names where the salt is the ingredient keep it", () => {
  it.each([
    "docusate sodium",
    "docusate calcium",
    "magnesium citrate",
    "magnesium hydroxide",
    "magnesium oxide",
    "magnesium carbonate",
    "magnesium salicylate",
    "calcium carbonate",
    "calcium polycarbophil",
    "sodium bicarbonate",
    "sodium salicylate",
    "sodium chloride",
    "aluminum hydroxide",
    "bismuth subsalicylate",
    "bismuth subgallate",
    "potassium nitrate",
    "potassium iodide",
    "sodium fluoride",
    "stannous fluoride",
    "sodium monofluorophosphate",
    "cetylpyridinium chloride",
    "benzalkonium chloride",
    "zinc chloride",
    "methyl salicylate",
    "choline salicylate",
    "dimenhydrinate",
    "simethicone",
  ])("%s", (name) => {
    expect(normalizeIngredient(name)).toBe(name);
    expect(normalizeIngredient(`${name.toUpperCase()} USP 100 mg`)).toBe(name);
  });

  it("keeps polyethylene glycol (digits are dropped from every name)", () => {
    expect(normalizeIngredient("Polyethylene Glycol 3350, 17 g")).toBe("polyethylene glycol");
    expect(normalizeIngredient("POLYETHYLENE GLYCOL 3350")).toBe("polyethylene glycol");
  });

  it("does not let a bare element swallow its salts", () => {
    expect(normalizeIngredient("Calcium citrate")).toBe("calcium citrate");
    expect(normalizeIngredient("Magnesium gluconate")).toBe("magnesium gluconate");
    expect(normalizeIngredient("Zinc gluconate USP")).toBe("zinc gluconate");
    expect(normalizeIngredient("Aluminum hydroxide dried gel 200 mg")).toBe("aluminum hydroxide");
  });
});

describe("normalizeIngredient — different active moieties stay apart", () => {
  it.each([
    ["Chlorpheniramine maleate", "Dexchlorpheniramine maleate"], // dex- is one enantiomer, its own ingredient
    ["Brompheniramine maleate", "Dexbrompheniramine maleate"],
    ["Cetirizine HCl", "Levocetirizine dihydrochloride"],
    ["Pheniramine maleate", "Chlorpheniramine maleate"],
    ["Levonorgestrel", "Norgestrel"],
    ["Menthol", "Levomenthol"],
    ["Dimenhydrinate", "Diphenhydramine HCl"], // a salt of diphenhydramine, but dosed and labelled as itself
    ["Docusate sodium", "Docusate calcium"],
    ["Magnesium hydroxide", "Magnesium citrate"],
    ["Magnesium oxide", "Magnesium carbonate"],
    ["Sodium fluoride", "Stannous fluoride"],
    ["Aspirin", "Sodium salicylate"],
    ["Aspirin", "Magnesium salicylate"],
    ["Aspirin", "Bismuth subsalicylate"],
    ["Aspirin", "Methyl salicylate"],
    ["Pseudoephedrine HCl", "Ephedrine sulfate"],
    ["Omeprazole", "Esomeprazole magnesium"],
    ["Bisacodyl", "Deacetylbisacodyl"],
    ["Sennosides", "Senna pods"],
  ])("%s ≠ %s", (a, b) => {
    expect(normalizeIngredient(a)).not.toBe(normalizeIngredient(b));
  });
});

describe("normalizeIngredient — generic spelling rules", () => {
  it.each([
    ["Zinc gluconate USP", "zinc gluconate"],
    ["Zinc gluconate, USP", "zinc gluconate"],
    ["Zinc gluconate USP/NF", "zinc gluconate"],
    ["Glycerin NF", "glycerin"],
  ])("drops a trailing USP/NF: %s → %s", (raw, expected) => {
    expect(normalizeIngredient(raw)).toBe(expected);
  });

  it.each([
    ["Cetirizine HCI USP 10 mg", "cetirizine"],
    ["Loperamide HCI 2 mg", "loperamide"],
    ["Triprolidine HCI 1.25 mg", "triprolidine"],
    ["Hydroxyzine HCI", "hydroxyzine hcl"],
  ])("reads HCI (capital i) as HCl: %s → %s", (raw, expected) => {
    expect(normalizeIngredient(raw)).toBe(expected);
  });

  it.each([
    ["DEXTROSE, UNSPECIFIED FORM", "dextrose"],
    ["SODIUM PHOSPHATE, MONOBASIC, UNSPECIFIED FORM", "sodium phosphate monobasic"],
    ["MAGNESIUM SULFATE, UNSPECIFIED", "magnesium sulfate"],
  ])("drops FDA's trailing 'unspecified (form)': %s → %s", (raw, expected) => {
    expect(normalizeIngredient(raw)).toBe(expected);
  });

  it("only drops USP at the end, never inside a name", () => {
    expect(normalizeIngredient("Uspolin tablets")).toBe("uspolin tablets");
  });
});

// Every active-ingredient name openFDA lists for oral, sublingual and buccal OTC products (homeopathic
// excluded), grouped by what normalizeIngredient() returns. Editing the synonym table changes this map:
// update it on purpose. A group of one is a name kept as FDA spells it, after cleaning (lowercase, no digits or punctuation).
const EXPECTED: Record<string, string[]> = {
  "acetaminophen": ["ACETAMINOPHEN"],
  "aconitum napellus": ["ACONITUM NAPELLUS"],
  "activated charcoal": ["ACTIVATED CHARCOAL"],
  "agrimonia eupatoria": ["AGRIMONIA EUPATORIA"],
  "akebia stem": ["AKEBIA STEM"],
  "alisma plantago-aquatica root": ["ALISMA PLANTAGO-AQUATICA ROOT"],
  "allantoin": ["ALLANTOIN"],
  "allicin": ["ALLICIN"],
  "allium sativum whole": ["ALLIUM SATIVUM WHOLE"],
  "alpha -tocopherol": [".ALPHA.-TOCOPHEROL"],
  "alpha -tocopherol acetate": [".ALPHA.-TOCOPHEROL ACETATE"],
  "aluminum chloride": ["ALUMINUM CHLORIDE"],
  "aluminum hydroxide": ["ALUMINUM HYDROXIDE"],
  "aluminum phosphate": ["ALUMINUM PHOSPHATE"],
  "amino acids": ["AMINO ACIDS"],
  "angelica gigas root": ["ANGELICA GIGAS ROOT"],
  "anoectochilus roxburghii whole": ["ANOECTOCHILUS ROXBURGHII WHOLE"],
  "arabica coffee bean": ["ARABICA COFFEE BEAN"],
  "arnica montana whole": ["ARNICA MONTANA WHOLE"],
  "arsenic trioxide": ["ARSENIC TRIOXIDE"],
  "ascorbic acid": ["ASCORBIC ACID"],
  "asian ginseng": ["ASIAN GINSENG"],
  "aspirin": ["ASPIRIN"],
  "astragalus gummifer root": ["ASTRAGALUS GUMMIFER ROOT"],
  "atractylodes macrocephala root": ["ATRACTYLODES MACROCEPHALA ROOT"],
  "avena sativa flowering top": ["AVENA SATIVA FLOWERING TOP"],
  "babesia microti": ["BABESIA MICROTI"],
  "banana": ["BANANA"],
  "baptisia tinctoria root": ["BAPTISIA TINCTORIA ROOT"],
  "barley malt": ["BARLEY MALT"],
  "benzalkonium chloride": ["BENZALKONIUM CHLORIDE"],
  "benzocaine": ["BENZOCAINE"],
  "beta -sitosterol": [".BETA.-SITOSTEROL"],
  "beta carotene": ["BETA CAROTENE"],
  "bicarbonate ion": ["BICARBONATE ION"],
  "biotin": ["BIOTIN"],
  "bisacodyl": ["BISACODYL"],
  "bismuth": ["BISMUTH"],
  "bismuth subgallate": ["BISMUTH SUBGALLATE"],
  "bismuth subsalicylate": ["BISMUTH SUBSALICYLATE"],
  "black pepper": ["BLACK PEPPER"],
  "borrelia burgdorferi": ["BORRELIA BURGDORFERI"],
  "brompheniramine": ["BROMPHENIRAMINE MALEATE"],
  "bryonia alba root": ["BRYONIA ALBA ROOT"],
  "caffeine": ["CAFFEINE"],
  "cairina moschata heart liver autolysate": ["CAIRINA MOSCHATA HEART/LIVER AUTOLYSATE"],
  "calcium": ["CALCIUM"],
  "calcium carbonate": ["CALCIUM CARBONATE"],
  "calcium cation": ["CALCIUM CATION"],
  "calcium polycarbophil": ["CALCIUM POLYCARBOPHIL"],
  "calcium sulfide": ["CALCIUM SULFIDE"],
  "carbamide peroxide": ["CARBAMIDE PEROXIDE"],
  "carica papaya whole": ["CARICA PAPAYA WHOLE"],
  "castor oil": ["CASTOR OIL"],
  "centella asiatica triterpenoids": ["CENTELLA ASIATICA TRITERPENOIDS"],
  "cetirizine": ["CETIRIZINE HYDROCHLORIDE"],
  "cetylpyridinium chloride": ["CETYLPYRIDINIUM CHLORIDE"],
  "chelidonium majus whole": ["CHELIDONIUM MAJUS WHOLE"],
  "chicken bone": ["CHICKEN BONE"],
  "chinese cinnamon": ["CHINESE CINNAMON"],
  "chlophedianol": ["CHLOPHEDIANOL HYDROCHLORIDE"],
  "chlorcyclizine": ["CHLORCYCLIZINE HYDROCHLORIDE"],
  "chlorhexidine digluconate": ["CHLORHEXIDINE DIGLUCONATE"],
  "chlorpheniramine": ["CHLORPHENIRAMINE MALEATE"],
  "choline salicylate": ["CHOLINE SALICYLATE"],
  "chondroitin sulfate": ["CHONDROITIN SULFATE (BOVINE)"],
  "cimetidine": ["CIMETIDINE"],
  "cinnamon": ["CINNAMON"],
  "citric acid": ["ANHYDROUS CITRIC ACID", "CITRIC ACID MONOHYDRATE"],
  "codeine": ["CODEINE PHOSPHATE"],
  "colchicum autumnale bulb": ["COLCHICUM AUTUMNALE BULB"],
  "coptis japonica root": ["COPTIS JAPONICA ROOT"],
  "curcuma aromatica root": ["CURCUMA AROMATICA ROOT"],
  "deacetylbisacodyl": ["DEACETYLBISACODYL"],
  "dexbrompheniramine": ["DEXBROMPHENIRAMINE MALEATE"],
  "dexchlorpheniramine": ["DEXCHLORPHENIRAMINE MALEATE"],
  "dextromethorphan": ["DEXTROMETHORPHAN", "DEXTROMETHORPHAN HYDROBROMIDE", "DEXTROMETHORPHAN HYDROCHLORIDE"],
  "dextrose": ["DEXTROSE", "DEXTROSE, UNSPECIFIED FORM"],
  "dimenhydrinate": ["DIMENHYDRINATE"],
  "diphenhydramine": ["DIPHENHYDRAMINE", "DIPHENHYDRAMINE CITRATE", "DIPHENHYDRAMINE HCL", "DIPHENHYDRAMINE HYDROCHLORIDE"],
  "docusate calcium": ["DOCUSATE CALCIUM"],
  "docusate sodium": ["DOCUSATE SODIUM"],
  "doxylamine": ["DOXYLAMINE SUCCINATE"],
  "dyclonine": ["DYCLONINE HYDROCHLORIDE"],
  "echinacea angustifolia whole": ["ECHINACEA ANGUSTIFOLIA WHOLE"],
  "egg shell membrane": ["EGG SHELL MEMBRANE"],
  "ehrlichia canis": ["EHRLICHIA CANIS"],
  "ephedrine": ["EPHEDRINE HYDROCHLORIDE", "EPHEDRINE SULFATE"],
  "equisetum arvense top": ["EQUISETUM ARVENSE TOP"],
  "esomeprazole": ["ESOMEPRAZOLE", "ESOMEPRAZOLE MAGNESIUM", "ESOMEPRAZOLE MAGNESIUM DIHYDRATE", "ESOMEPRAZOLE MAGNESIUM TRIHYDRATE"],
  "eucalyptol": ["EUCALYPTOL"],
  "eurycoma longifolia root": ["EURYCOMA LONGIFOLIA ROOT"],
  "eurycoma longifolia whole": ["EURYCOMA LONGIFOLIA WHOLE"],
  "famotidine": ["FAMOTIDINE"],
  "fenbendazole": ["FENBENDAZOLE"],
  "ferrous sulfate": ["FERROUS SULFATE"],
  "feverfew": ["FEVERFEW"],
  "fexofenadine": ["FEXOFENADINE HYDROCHLORIDE"],
  "fibraurea tinctoria whole": ["FIBRAUREA TINCTORIA WHOLE"],
  "fluoride ion": ["FLUORIDE ION"],
  "flurbiprofen": ["FLURBIPROFEN"],
  "folic acid": ["FOLIC ACID"],
  "forsythia suspensa fruit": ["FORSYTHIA SUSPENSA FRUIT"],
  "fructose": ["FRUCTOSE"],
  "fu ling": ["FU LING"],
  "gardenia jasminoides fruit": ["GARDENIA JASMINOIDES FRUIT"],
  "gelsemium sempervirens root": ["GELSEMIUM SEMPERVIRENS ROOT"],
  "ginger": ["GINGER"],
  "ginkgo biloba leaf": ["GINKGO BILOBA LEAF"],
  "glucosamine sulfate potassium chloride": ["GLUCOSAMINE SULFATE POTASSIUM CHLORIDE"],
  "glycerin": ["GLYCERIN"],
  "goldenseal": ["GOLDENSEAL"],
  "guaifenesin": ["GUAIFENESIN"],
  "hawthorn leaf with flower": ["HAWTHORN LEAF WITH FLOWER"],
  "hepatitis b virus": ["HEPATITIS B VIRUS"],
  "hexylresorcinol": ["HEXYLRESORCINOL"],
  "hippophae rhamnoides whole": ["HIPPOPHAE RHAMNOIDES WHOLE"],
  "houttuynia cordata top": ["HOUTTUYNIA CORDATA TOP"],
  "hydrated silica": ["HYDRATED SILICA"],
  "hydrogen peroxide": ["HYDROGEN PEROXIDE"],
  "hydrolysed bovine collagen enzymatic": ["HYDROLYSED BOVINE COLLAGEN (ENZYMATIC"],
  "ibuprofen": ["IBUPROFEN", "IBUPROFEN SODIUM"],
  "indian frankincense": ["INDIAN FRANKINCENSE"],
  "inulin": ["INULIN"],
  "ipomoea purga root": ["IPOMOEA PURGA ROOT"],
  "jujube fruit": ["JUJUBE FRUIT"],
  "kaempferol": ["KAEMPFEROL"],
  "kalmia latifolia leaf": ["KALMIA LATIFOLIA LEAF"],
  "laminaria japonica": ["LAMINARIA JAPONICA"],
  "lansoprazole": ["LANSOPRAZOLE"],
  "lapine s- immune globulin": ["LAPINE S-100 IMMUNE GLOBULIN"],
  "ledum palustre twig": ["LEDUM PALUSTRE TWIG"],
  "lepidium meyenii root": ["LEPIDIUM MEYENII ROOT"],
  "levocetirizine": ["LEVOCETIRIZINE DIHYDROCHLORIDE"],
  "levomenthol": ["LEVOMENTHOL"],
  "levonorgestrel": ["LEVONORGESTREL"],
  "levothyroxine": ["LEVOTHYROXINE"],
  "licorice": ["LICORICE"],
  "ligusticum sinense subsp chuanxiong root": ["LIGUSTICUM SINENSE SUBSP. CHUANXIONG ROOT"],
  "liothyronine": ["LIOTHYRONINE"],
  "liriope spicata tuber": ["LIRIOPE SPICATA TUBER"],
  "lonicera caprifolium flower": ["LONICERA CAPRIFOLIUM FLOWER"],
  "lonicera hypoglauca flower": ["LONICERA HYPOGLAUCA FLOWER"],
  "loperamide": ["LOPERAMIDE HYDROCHLORIDE"],
  "loratadine": ["LORATADINE"],
  "lycopodium clavatum spore": ["LYCOPODIUM CLAVATUM SPORE"],
  "magnesium": ["MAGNESIUM"],
  "magnesium carbonate": ["MAGNESIUM CARBONATE"],
  "magnesium citrate": ["MAGNESIUM CITRATE"],
  "magnesium hydroxide": ["MAGNESIUM HYDROXIDE"],
  "magnesium oxide": ["MAGNESIUM OXIDE"],
  "magnesium salicylate": ["MAGNESIUM SALICYLATE"],
  "magnesium sulfate": ["MAGNESIUM SULFATE HEPTAHYDRATE", "MAGNESIUM SULFATE, UNSPECIFIED", "MAGNESIUM SULFATE, UNSPECIFIED FORM"],
  "mangifera indica leaf": ["MANGIFERA INDICA LEAF"],
  "marine collagen soluble": ["MARINE COLLAGEN, SOLUBLE"],
  "maritime pine": ["MARITIME PINE"],
  "matricaria chamomilla whole": ["MATRICARIA CHAMOMILLA WHOLE"],
  "meclizine": ["MECLIZINE DIHYDROCHLORIDE", "MECLIZINE HYDROCHLORIDE"],
  "menaquinone-": ["MENAQUINONE-7"],
  "menthol": ["MENTHOL", "MENTHOL, UNSPECIFIED FORM"],
  "mercurius solubilis": ["MERCURIUS SOLUBILIS"],
  "methenamine": ["METHENAMINE"],
  "methyl salicylate": ["METHYL SALICYLATE"],
  "methylcellulose": ["METHYLCELLULOSE (4000 CPS)", "METHYLCELLULOSE (4000 MPA.S)"],
  "metronidazole": ["METRONIDAZOLE"],
  "mineral oil": ["MINERAL OIL"],
  "momordica charantia stem": ["MOMORDICA CHARANTIA STEM"],
  "morus alba leaf": ["MORUS ALBA LEAF"],
  "mw": ["3500 MW)"],
  "naproxen": ["NAPROXEN SODIUM"],
  "nattokinase": ["NATTOKINASE"],
  "neisseria meningitidis": ["NEISSERIA MENINGITIDIS"],
  "nelumbo nucifera seed": ["NELUMBO NUCIFERA SEED"],
  "niacin": ["NIACIN"],
  "nicotine": ["NICOTINE"],
  "nitric acid": ["NITRIC ACID"],
  "norgestrel": ["NORGESTREL"],
  "nutmeg": ["NUTMEG"],
  "oat": ["OAT"],
  "omeprazole": ["OMEPRAZOLE", "OMEPRAZOLE MAGNESIUM"],
  "ophiopogon japonicus whole": ["OPHIOPOGON JAPONICUS WHOLE"],
  "orlistat": ["ORLISTAT"],
  "ostrea edulis shell": ["OSTREA EDULIS SHELL"],
  "oxygen": ["OXYGEN"],
  "paeonia lactiflora root": ["PAEONIA LACTIFLORA ROOT"],
  "palladium": ["PALLADIUM"],
  "pamabrom": ["PAMABROM"],
  "panax ginseng root oil": ["PANAX GINSENG ROOT OIL"],
  "pancrelipase": ["PANCRELIPASE"],
  "panthenol": ["PANTHENOL"],
  "pantothenic acid": ["PANTOTHENIC ACID"],
  "passiflora incarnata flowering top": ["PASSIFLORA INCARNATA FLOWERING TOP"],
  "pectin": ["PECTIN"],
  "pentoxyverine": ["PENTOXYVERINE CITRATE"],
  "perilla frutescens leaf": ["PERILLA FRUTESCENS LEAF"],
  "perilla frutescens whole": ["PERILLA FRUTESCENS WHOLE"],
  "phellodendron chinensis bark": ["PHELLODENDRON CHINENSIS BARK"],
  "phenazopyridine": ["PHENAZOPYRIDINE HYDROCHLORIDE"],
  "pheniramine": ["PHENIRAMINE MALEATE"],
  "phenol": ["PHENOL"],
  "phenylephrine": ["PHENYLEPHRINE", "PHENYLEPHRINE BITARTRATE", "PHENYLEPHRINE HYDROCHLORIDE"],
  "phosphatidyl serine": ["PHOSPHATIDYL SERINE"],
  "phosphoric acid": ["PHOSPHORIC ACID"],
  "phosphorus": ["PHOSPHORUS"],
  "piper sarmentosum whole": ["PIPER SARMENTOSUM WHOLE"],
  "plantago seed": ["PLANTAGO SEED"],
  "platycodon grandiflorum root": ["PLATYCODON GRANDIFLORUM ROOT"],
  "platycodon grandiflorus whole": ["PLATYCODON GRANDIFLORUS WHOLE"],
  "policresulen": ["POLICRESULEN"],
  "polyethylene glycol": ["POLYETHYLENE GLYCOL 3350", "POLYETHYLENE GLYCOL 3500"],
  "poncirus trifoliata fruit": ["PONCIRUS TRIFOLIATA FRUIT"],
  "potassium": ["POTASSIUM"],
  "potassium bicarbonate": ["POTASSIUM BICARBONATE"],
  "potassium dichromate": ["POTASSIUM DICHROMATE"],
  "potassium iodide": ["POTASSIUM IODIDE"],
  "potassium nitrate": ["POTASSIUM NITRATE"],
  "potassium phosphate dibasic": ["POTASSIUM PHOSPHATE, DIBASIC"],
  "potassium sulfate": ["POTASSIUM SULFATE"],
  "povidone-iodine": ["POVIDONE-IODINE"],
  "propyphenazone": ["PROPYPHENAZONE"],
  "pseudoephedrine": ["PSEUDOEPHEDRINE HYDROCHLORIDE", "PSEUDOEPHEDRINE SULFATE"],
  "psyllium": ["PSYLLIUM HUSK"],
  "pueraria montana var lobata whole": ["PUERARIA MONTANA VAR. LOBATA WHOLE"],
  "pulsatilla pratensis whole": ["PULSATILLA PRATENSIS WHOLE"],
  "pulsatilla vulgaris whole": ["PULSATILLA VULGARIS WHOLE"],
  "pyrantel": ["PYRANTEL PAMOATE"],
  "pyridoxine": ["PYRIDOXINE", "PYRIDOXINE HYDROCHLORIDE"],
  "pyrilamine": ["PYRILAMINE MALEATE"],
  "quercetin": ["QUERCETIN"],
  "ranitidine": ["RANITIDINE HYDROCHLORIDE"],
  "rehmannia glutinosa root": ["REHMANNIA GLUTINOSA ROOT"],
  "reishi": ["REISHI"],
  "reynoutria japonica root": ["REYNOUTRIA JAPONICA ROOT"],
  "rheum palmatum root": ["RHEUM PALMATUM ROOT"],
  "rhubarb": ["RHUBARB"],
  "riboflavin": ["RIBOFLAVIN"],
  "rice germ": ["RICE GERM"],
  "rutin": ["RUTIN"],
  "salix alba bark": ["SALIX ALBA BARK"],
  "saposhnikovia divaricata root": ["SAPOSHNIKOVIA DIVARICATA ROOT"],
  "saw palmetto": ["SAW PALMETTO"],
  "schisandra chinensis seed": ["SCHISANDRA CHINENSIS SEED"],
  "scutellaria baicalensis root": ["SCUTELLARIA BAICALENSIS ROOT"],
  "senna alata leaf": ["SENNA ALATA LEAF"],
  "senna pods": ["SENNA PODS"],
  "sennosides": ["SENNOSIDES", "SENNOSIDES A AND B"],
  "sepia officinalis juice": ["SEPIA OFFICINALIS JUICE"],
  "shiitake mushroom": ["SHIITAKE MUSHROOM"],
  "sigesbeckia orientalis whole": ["SIGESBECKIA ORIENTALIS WHOLE"],
  "silica": ["SILICA"],
  "silicon dioxide": ["SILICON DIOXIDE"],
  "silodrate": ["SILODRATE"],
  "simethicone": ["DIMETHICONE", "DIMETHICONE 410", "DIMETHICONE, UNSPECIFIED"],
  "sodium": ["SODIUM"],
  "sodium bicarbonate": ["SODIUM BICARBONATE"],
  "sodium carbonate": ["SODIUM CARBONATE"],
  "sodium chloride": ["SODIUM CHLORIDE"],
  "sodium fluoride": ["SODIUM FLUORIDE"],
  "sodium monofluorophosphate": ["SODIUM MONOFLUOROPHOSPHATE"],
  "sodium perborate monohydrate": ["SODIUM PERBORATE MONOHYDRATE"],
  "sodium phosphate dibasic": ["SODIUM PHOSPHATE, DIBASIC"],
  "sodium phosphate monobasic": ["SODIUM PHOSPHATE, MONOBASIC, UNSPECIFIED FORM"],
  "sodium pyrophosphate": ["SODIUM PYROPHOSPHATE"],
  "sodium salicylate": ["SODIUM SALICYLATE"],
  "soybean lecithin": ["SOYBEAN LECITHIN"],
  "stannous fluoride": ["STANNOUS FLUORIDE"],
  "stem bromelain": ["STEM BROMELAIN"],
  "strychnos ignatii seed": ["STRYCHNOS IGNATII SEED"],
  "strychnos nux-vomica seed": ["STRYCHNOS NUX-VOMICA SEED"],
  "tangerine": ["TANGERINE"],
  "taraxacum palustre root": ["TARAXACUM PALUSTRE ROOT"],
  "tellurium": ["TELLURIUM"],
  "thiamine": ["THIAMINE"],
  "thuja occidentalis leafy twig": ["THUJA OCCIDENTALIS LEAFY TWIG"],
  "thymol": ["THYMOL"],
  "titanium dioxide": ["TITANIUM DIOXIDE"],
  "toxicodendron pubescens leaf": ["TOXICODENDRON PUBESCENS LEAF"],
  "triprolidine": ["TRIPROLIDINE HYDROCHLORIDE"],
  "trisodium citrate dihydrate": ["TRISODIUM CITRATE DIHYDRATE"],
  "turmeric": ["TURMERIC"],
  "ubiquinol": ["UBIQUINOL"],
  "valerian": ["VALERIAN"],
  "vitamin d": ["VITAMIN D"],
  "water": ["WATER"],
  "wolfiporia cocos whole": ["WOLFIPORIA COCOS WHOLE"],
  "yeast": ["YEAST"],
  "zinc": ["ZINC"],
  "zinc cation": ["ZINC CATION"],
  "zinc chloride": ["ZINC CHLORIDE"],
  "zinc oxide": ["ZINC OXIDE"],
  "zingiber officinale whole": ["ZINGIBER OFFICINALE WHOLE"],
};

type Count = { term: string; count: number };
const routes = fda.ndcActiveIngredientCounts as Record<string, Count[]>;
const fdaNames = [...new Set(Object.values(routes).flatMap((list) => list.map((c) => c.term)))].sort();
const canonicalOf = new Map(Object.entries(EXPECTED).flatMap(([canonical, names]) => names.map((n) => [n, canonical])));

describe("normalizeIngredient — openFDA OTC ingredient names (fixture)", () => {
  it("lists each fixture name exactly once, and nothing else", () => {
    const listed = Object.values(EXPECTED).flat();
    expect(listed.length).toBe(new Set(listed).size);
    expect([...listed].sort()).toEqual(fdaNames);
  });

  it.each(fdaNames)("%s", (name) => {
    expect(normalizeIngredient(name)).toBe(canonicalOf.get(name));
  });

  it("covers every name in at least 5 oral OTC products", () => {
    const common = routes.ORAL.filter((c) => c.count >= 5).map((c) => c.term);
    expect(common.length).toBeGreaterThanOrEqual(100);
    for (const name of common) expect(canonicalOf.has(name)).toBe(true);
  });

  const spellings = Object.entries(fda.labelSpellings as Record<string, string[]>).flatMap(([substance, list]) =>
    list.map((printed) => [printed, substance] as const),
  );
  it.each(spellings)("Drug Facts spelling %s matches FDA's %s", (printed, substance) => {
    expect(normalizeIngredient(printed)).toBe(canonicalOf.get(substance));
  });
});
