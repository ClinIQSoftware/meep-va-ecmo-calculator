# VA ECMO Calculator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a single-page web calculator implementing the MEEP protocol for VO2/VCO2/EE in VA ECMO patients, including Bachmann cardiac output estimation.

**Architecture:** Vanilla HTML/CSS/JS, no frameworks. Core computation engine is a faithful JavaScript port of the Dash & Bassingthwaighte SHbO2CO2_EJAP2016 MATLAB model. Three-panel UI: lung inputs → ECMO inputs → results.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript (ES6+). No build tools or dependencies.

---

### Task 1: Project Scaffolding

**Files:**
- Create: `index.html`
- Create: `js/dash-model.js`
- Create: `js/calculations.js`
- Create: `js/app.js`
- Create: `css/style.css`
- Create: `tests/test.html`
- Create: `tests/test-dash-model.js`

**Step 1: Create directory structure**

```bash
mkdir -p js css tests
```

**Step 2: Create minimal index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VA ECMO - MEEP Calculator</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <div id="app">
        <h1>VA ECMO — MEEP Calculator</h1>
        <p>Oxygen Consumption &amp; Energy Expenditure</p>
    </div>
    <script src="js/dash-model.js"></script>
    <script src="js/calculations.js"></script>
    <script src="js/app.js"></script>
</body>
</html>
```

**Step 3: Create empty JS/CSS files**

Create placeholder files for `js/dash-model.js`, `js/calculations.js`, `js/app.js`, `css/style.css`.

**Step 4: Create test harness**

```html
<!-- tests/test.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>MEEP Calculator Tests</title>
    <style>
        body { font-family: monospace; padding: 20px; }
        .pass { color: green; }
        .fail { color: red; font-weight: bold; }
        #results { white-space: pre-wrap; }
    </style>
</head>
<body>
    <h1>MEEP Calculator — Test Suite</h1>
    <div id="results"></div>
    <script src="../js/dash-model.js"></script>
    <script src="../js/calculations.js"></script>
    <script>
    const results = document.getElementById('results');
    let passed = 0, failed = 0;

    function assert(name, actual, expected, tolerance = 1e-6) {
        const relErr = Math.abs(expected) > 1e-15
            ? Math.abs((actual - expected) / expected)
            : Math.abs(actual - expected);
        if (relErr <= tolerance) {
            results.innerHTML += `<span class="pass">PASS</span> ${name}: ${actual}\n`;
            passed++;
        } else {
            results.innerHTML += `<span class="fail">FAIL</span> ${name}: got ${actual}, expected ${expected} (relErr: ${relErr.toExponential(3)})\n`;
            failed++;
        }
    }

    function summary() {
        results.innerHTML += `\n---\nTotal: ${passed + failed} | Passed: ${passed} | Failed: ${failed}\n`;
    }
    </script>
    <script src="test-dash-model.js"></script>
</body>
</html>
```

**Step 5: Create empty test file**

```js
// tests/test-dash-model.js
// Tests will be added in Task 2
summary();
```

**Step 6: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold project structure with test harness"
```

---

### Task 2: Port Dash & Bassingthwaighte Model — Constants and P50 Calculation

**Files:**
- Modify: `js/dash-model.js`
- Modify: `tests/test-dash-model.js`

**Step 1: Write failing tests for the Dash model at standard conditions**

At standard physiological conditions (pO2=100, pCO2=40, pHrbc=7.24, DPG=4.65e-3, Temp=37, Hbrbc=0.0052, Hct=0.45):
- SHbO2 should be ~0.974 (97.4% — normal arterial saturation)
- P50 should be 26.8 mmHg (standard, since all deltas are zero)
- O2 content should be ~20.4 mL/100mL (normal arterial)

Add to `tests/test-dash-model.js`:

```js
// Test 1: Standard physiological conditions
(function testStandardConditions() {
    results.innerHTML += '\n=== Dash Model: Standard Conditions ===\n';
    const input = {
        pO2: 100,        // mmHg
        pCO2: 40,        // mmHg
        pHrbc: 7.24,     // unitless
        DPGrbc: 4.65e-3, // M
        Temp: 37,         // degC
        Hbrbc: 0.0052,   // M (approximate for Hct=0.45)
        Hct: 0.45        // unitless
    };
    const output = SHbO2CO2(input);

    // P50 at standard conditions = P500 = 26.8 mmHg
    assert('P50 at standard', output.P50, 26.8, 1e-4);

    // SHbO2 at pO2=100, standard conditions ~0.974
    assert('SHbO2 at standard', output.SHbO2, 0.974, 5e-3);

    // O2 content ~20 mL/100mL (typical arterial)
    assert('O2cont reasonable range', output.O2cont > 15 && output.O2cont < 25, true, 0);

    // CO2 content with bicarb ~45-55 mL/100mL (typical)
    assert('CO2cont2 reasonable range', output.CO2cont2 > 40 && output.CO2cont2 < 60, true, 0);

    // alphaO2 at 37C = 1.46e-6 (no temp correction)
    assert('alphaO2 at 37C', output.alphaO2, 1.46e-6, 1e-4);
})();

// Test 2: Venous blood (pO2=40, pCO2=46)
(function testVenousConditions() {
    results.innerHTML += '\n=== Dash Model: Venous Conditions ===\n';
    const input = {
        pO2: 40,          // mmHg (mixed venous)
        pCO2: 46,         // mmHg (venous)
        pHrbc: 7.20,      // slightly more acidic
        DPGrbc: 4.65e-3,
        Temp: 37,
        Hbrbc: 0.0052,
        Hct: 0.45
    };
    const output = SHbO2CO2(input);

    // SHbO2 at pO2=40 should be ~0.73 (mixed venous saturation)
    assert('SHbO2 venous', output.SHbO2, 0.73, 0.05);

    // O2 content venous ~15 mL/100mL
    assert('O2cont venous reasonable', output.O2cont > 10 && output.O2cont < 18, true, 0);
})();

// Test 3: Post-oxygenator (high pO2)
(function testPostOxygenator() {
    results.innerHTML += '\n=== Dash Model: Post-Oxygenator ===\n';
    const input = {
        pO2: 300,         // mmHg (post membrane oxygenator)
        pCO2: 35,         // mmHg (post membrane)
        pHrbc: 7.26,
        DPGrbc: 4.65e-3,
        Temp: 37,
        Hbrbc: 0.0052,
        Hct: 0.45
    };
    const output = SHbO2CO2(input);

    // SHbO2 should be ~1.0 at pO2=300
    assert('SHbO2 post-oxy near 1.0', output.SHbO2, 1.0, 0.01);

    // O2 content higher due to dissolved O2
    assert('O2cont post-oxy > arterial', output.O2cont > 20, true, 0);
})();

summary();
```

**Step 2: Open tests/test.html in browser to verify tests fail**

Expected: All tests fail because `SHbO2CO2` function doesn't exist yet.

**Step 3: Implement the Dash model in js/dash-model.js**

This is the faithful port of the MATLAB function:

```js
/**
 * Dash & Bassingthwaighte SHbO2CO2 Model (EJAP 2016 revision)
 * Computes oxyhemoglobin/carbaminohemoglobin dissociation and
 * O2/CO2 content in whole blood.
 *
 * Reference: Dash & Bassingthwaighte, ABME 38(4):1683-1701, 2010
 * Revised: Dash, 2/29/2016
 *
 * @param {Object} input - { pO2, pCO2, pHrbc, DPGrbc, Temp, Hbrbc, Hct }
 * @returns {Object} - { SHbO2, SHbCO2, O2cont, CO2cont1, CO2cont2, P50, alphaO2, alphaCO2, ... }
 */
function SHbO2CO2(input) {
    const { pO2, pCO2, pHrbc, DPGrbc, Temp, Hbrbc, Hct } = input;

    // Fixed parameters
    const Wpl = 0.94;
    const Wrbc = 0.65;
    const Wbl = (1 - Hct) * Wpl + Hct * Wrbc;
    const K1 = Math.pow(10, -6.12);
    const K2 = 21.5e-6;
    const K2dp = 1e-6;
    const K2p = K2 / K2dp;
    const K3 = 11.3e-6;
    const K3dp = 1e-6;
    const K3p = K3 / K3dp;
    const K5dp = 2.4e-8;
    const K6dp = 1.2e-8;
    const Rrbc = 0.69;
    const mol2ml = 22400;

    // Standard conditions
    const pO20 = 100;
    const pCO20 = 40;
    const pHrbc0 = 7.24;
    const pHpl0 = pHrbc0 - Math.log10(Rrbc);
    const DPGrbc0 = 4.65e-3;
    const Temp0 = 37;
    const P500 = 26.8;
    const alphaO20 = 1.46e-6;
    const alphaCO20 = 32.66e-6;

    // Intermediate variables
    const pHpl = pHrbc - Math.log10(Rrbc);
    const delpHrbc = pHrbc - pHrbc0;
    const delpCO2 = pCO2 - pCO20;
    const delDPGrbc = DPGrbc - DPGrbc0;
    const delTemp = Temp - Temp0;

    const alphaO2 = alphaO20 * (1 - 1e-2 * delTemp + 4.234e-4 * delTemp * delTemp);
    const alphaCO2 = alphaCO20 * (1 - 1.86e-2 * delTemp + 6.515e-4 * delTemp * delTemp);

    const O2 = alphaO2 * pO2;
    const CO2 = alphaCO2 * pCO2;
    const Hrbc = Math.pow(10, -pHrbc);
    const Hpl = Math.pow(10, -pHpl);

    // P50 corrections
    const P501 = P500 + 1.2 * (-21.279 * delpHrbc + 8.872 * delpHrbc * delpHrbc - 1.47 * delpHrbc * delpHrbc * delpHrbc);
    const P502 = P500 + 1.7 * (4.28e-2 * delpCO2 + 3.64e-5 * delpCO2 * delpCO2);
    const P503 = P500 + 1.0 * (795.633533 * delDPGrbc - 19660.8947 * delDPGrbc * delDPGrbc);
    const P504 = P500 + 0.98 * (1.4945 * delTemp + 4.335e-2 * delTemp * delTemp + 7e-4 * delTemp * delTemp * delTemp);
    const P50 = P500 * (P501 / P500) * (P502 / P500) * (P503 / P500) * (P504 / P500);
    const C50 = alphaO2 * P50;

    // Variable Hill coefficient
    const nH = 2.8 - 1.2 * Math.pow(10, -pO2 / 29.2);

    // Binding polynomials
    const BPH1 = 1 + K2dp / Hrbc;
    const BPH2 = 1 + K3dp / Hrbc;
    const BPH3 = 1 + Hrbc / K5dp;
    const BPH4 = 1 + Hrbc / K6dp;

    // Apparent equilibrium constants
    const K4p = (Math.pow(O2, nH - 1) * (K2p * BPH1 * CO2 + BPH3)) / (Math.pow(C50, nH) * (K3p * BPH2 * CO2 + BPH4));
    const KHbO2 = K4p * (K3p * BPH2 * CO2 + BPH4) / (K2p * BPH1 * CO2 + BPH3);
    const KHbCO2 = (K2p * BPH1 + K3p * K4p * BPH2 * O2) / (BPH3 + K4p * BPH4 * O2);

    // Saturations
    const SHbO2 = KHbO2 * O2 / (1 + KHbO2 * O2);
    const SHbCO2 = KHbCO2 * CO2 / (1 + KHbCO2 * CO2);

    // O2 content
    const O2free = Wbl * O2;
    const O2bound = 4 * Hct * Hbrbc * SHbO2;
    const O2tot = O2free + O2bound;
    const O2cont = mol2ml * O2tot / 10;

    // CO2 content
    const CO2free = Wbl * CO2;
    const CO2bicarb = ((1 - Hct) * Wpl + Hct * Wrbc * Rrbc) * (K1 * CO2 / Hpl);
    const CO2bound = 4 * Hct * Hbrbc * SHbCO2;
    const CO2tot1 = CO2free + CO2bound;
    const CO2cont1 = mol2ml * CO2tot1 / 10;
    const CO2tot2 = CO2free + CO2bicarb + CO2bound;
    const CO2cont2 = mol2ml * CO2tot2 / 10;

    return {
        alphaO2, alphaCO2, P50, K4p, KHbO2, KHbCO2, SHbO2, SHbCO2,
        O2tot, CO2tot1, CO2tot2, O2cont, CO2cont1, CO2cont2,
        O2free, O2bound, CO2free, CO2bicarb, CO2bound,
        nH, C50, Wbl, pHpl
    };
}
```

**Step 4: Open tests/test.html in browser to verify tests pass**

Expected: All 3 test groups pass. P50=26.8 at standard conditions, SHbO2~0.974 arterial, reasonable O2/CO2 content ranges.

**Step 5: Commit**

```bash
git add js/dash-model.js tests/test-dash-model.js
git commit -m "feat: port Dash & Bassingthwaighte SHbO2CO2 model to JavaScript with tests"
```

---

### Task 3: MEEP Calculation Pipeline

**Files:**
- Modify: `js/calculations.js`
- Create: `tests/test-calculations.js`
- Modify: `tests/test.html` (add script tag)

**Step 1: Write failing tests for MEEP calculations**

Add `tests/test-calculations.js`:

```js
// Test MEEP calculation pipeline
(function testMEEPCalculation() {
    results.innerHTML += '\n=== MEEP Calculation Pipeline ===\n';

    // Simulated clinical scenario:
    // Pre-membrane (venous): pO2=40, pCO2=46, pH=7.35 (plasma)
    // Post-membrane: pO2=300, pCO2=35, pH=7.40 (plasma)
    // ECMO flow: 3.5 L/min
    // Lung IC: VO2_lung=50, VCO2_lung=40 mL/min

    const params = {
        pre: { pO2: 40, pCO2: 46, pH_plasma: 7.35 },
        post: { pO2: 300, pCO2: 35, pH_plasma: 7.40 },
        ecmoFlow: 3.5,        // L/min
        vo2Lung: 50,          // mL/min
        vco2Lung: 40,         // mL/min
        Temp: 37,
        Hct: 0.45,
        Hbrbc: 0.0052,
        DPGrbc: 4.65e-3,
        baroPressure: 760
    };

    const result = calculateMEEP(params);

    // VO2_ECMO should be positive (O2 gained across membrane)
    assert('VO2_ECMO positive', result.vo2ECMO > 0, true, 0);

    // VCO2_ECMO should be positive (CO2 removed across membrane)
    assert('VCO2_ECMO positive', result.vco2ECMO > 0, true, 0);

    // Totals should be sum
    assert('VO2_total = lung + ECMO', result.vo2Total, params.vo2Lung + result.vo2ECMO, 1e-10);
    assert('VCO2_total = lung + ECMO', result.vco2Total, params.vco2Lung + result.vco2ECMO, 1e-10);

    // RQ should be between 0.7 and 1.0 typically
    assert('RQ reasonable', result.rq > 0.5 && result.rq < 1.5, true, 0);

    // EE from Weir equation: (3.9*VO2 + 1.1*VCO2) * 1.44
    const expectedEE = (3.9 * result.vo2Total + 1.1 * result.vco2Total) * 1.44;
    assert('EE matches Weir equation', result.ee, expectedEE, 1e-10);

    // EE should be reasonable for ICU patient (800-3000 kcal/d)
    assert('EE reasonable range', result.ee > 500 && result.ee < 5000, true, 0);
})();

// Test Weir equation directly
(function testWeirEquation() {
    results.innerHTML += '\n=== Weir Equation ===\n';
    // Known: VO2=250 mL/min, VCO2=200 mL/min
    // EE = (3.9*250 + 1.1*200) * 1.44 = (975 + 220) * 1.44 = 1720.8 kcal/d
    assert('Weir equation', weirEquation(250, 200), 1720.8, 1e-10);
})();

summary();
```

**Step 2: Add script tag to tests/test.html**

Add before the closing `</body>`: `<script src="test-calculations.js"></script>`

**Step 3: Open tests/test.html to verify tests fail**

Expected: FAIL because `calculateMEEP` and `weirEquation` don't exist.

**Step 4: Implement calculations in js/calculations.js**

```js
/**
 * Weir equation for energy expenditure.
 * EE (kcal/d) = (3.9 * VO2 + 1.1 * VCO2) * 1.44
 *
 * @param {number} vo2Total - Total O2 consumption (mL/min)
 * @param {number} vco2Total - Total CO2 elimination (mL/min)
 * @returns {number} Energy expenditure (kcal/day)
 */
function weirEquation(vo2Total, vco2Total) {
    return (3.9 * vo2Total + 1.1 * vco2Total) * 1.44;
}

/**
 * Convert plasma pH to RBC pH using Gibbs-Donnan ratio.
 * pHrbc = pHplasma + log10(Rrbc)
 *
 * @param {number} pHplasma - Plasma pH
 * @returns {number} RBC pH
 */
function plasmapHToRBCpH(pHplasma) {
    const Rrbc = 0.69;
    return pHplasma + Math.log10(Rrbc);
}

/**
 * Full MEEP protocol calculation.
 *
 * @param {Object} params
 * @param {Object} params.pre - Pre-membrane BGA: { pO2, pCO2, pH_plasma }
 * @param {Object} params.post - Post-membrane BGA: { pO2, pCO2, pH_plasma }
 * @param {number} params.ecmoFlow - ECMO blood flow (L/min)
 * @param {number} params.vo2Lung - VO2 from lung IC (mL/min)
 * @param {number} params.vco2Lung - VCO2 from lung IC (mL/min)
 * @param {number} params.Temp - Temperature (°C)
 * @param {number} params.Hct - Hematocrit (fraction)
 * @param {number} params.Hbrbc - Hemoglobin in RBCs (M)
 * @param {number} params.DPGrbc - 2,3-DPG (M)
 * @param {number} params.baroPressure - Barometric pressure (mmHg)
 * @returns {Object} Results
 */
function calculateMEEP(params) {
    const { pre, post, ecmoFlow, vo2Lung, vco2Lung, Temp, Hct, Hbrbc, DPGrbc } = params;

    // Calculate blood gas content pre-membrane
    const preResult = SHbO2CO2({
        pO2: pre.pO2,
        pCO2: pre.pCO2,
        pHrbc: plasmapHToRBCpH(pre.pH_plasma),
        DPGrbc: DPGrbc,
        Temp: Temp,
        Hbrbc: Hbrbc,
        Hct: Hct
    });

    // Calculate blood gas content post-membrane
    const postResult = SHbO2CO2({
        pO2: post.pO2,
        pCO2: post.pCO2,
        pHrbc: plasmapHToRBCpH(post.pH_plasma),
        DPGrbc: DPGrbc,
        Temp: Temp,
        Hbrbc: Hbrbc,
        Hct: Hct
    });

    // O2 content difference: post - pre (O2 gained across membrane)
    // CO2 content difference: pre - post (CO2 removed across membrane)
    // Contents are in mL/100mL blood, flow in L/min
    // mL/min = (mL/100mL) * (L/min) * 10
    const vo2ECMO = (postResult.O2cont - preResult.O2cont) * ecmoFlow * 10;
    const vco2ECMO = (preResult.CO2cont2 - postResult.CO2cont2) * ecmoFlow * 10;

    // Total gas exchange
    const vo2Total = vo2Lung + vo2ECMO;
    const vco2Total = vco2Lung + vco2ECMO;

    // Respiratory quotient
    const rq = vco2Total / vo2Total;

    // Energy expenditure (Weir equation)
    const ee = weirEquation(vo2Total, vco2Total);

    return {
        preO2cont: preResult.O2cont,
        preCO2cont: preResult.CO2cont2,
        postO2cont: postResult.O2cont,
        postCO2cont: postResult.CO2cont2,
        preSHbO2: preResult.SHbO2,
        postSHbO2: postResult.SHbO2,
        vo2ECMO,
        vco2ECMO,
        vo2Total,
        vco2Total,
        rq,
        ee
    };
}
```

**Step 5: Open tests/test.html to verify all tests pass**

Expected: All MEEP pipeline tests pass + all Dash model tests still pass.

**Step 6: Commit**

```bash
git add js/calculations.js tests/test-calculations.js tests/test.html
git commit -m "feat: implement MEEP calculation pipeline with Weir equation"
```

---

### Task 4: Bachmann Cardiac Output Estimation

**Files:**
- Modify: `js/calculations.js`
- Create: `tests/test-bachmann.js`
- Modify: `tests/test.html`

**Step 1: Write failing tests for Bachmann calculations**

Add `tests/test-bachmann.js`:

```js
(function testBachmannVCO2ECMO() {
    results.innerHTML += '\n=== Bachmann: VCO2 from gas phase ===\n';

    // From Bachmann Eq. 1: VCO2_ECMO = peCO2_ECMO * V_ECMO / baroPressure * 1000
    // peCO2 = 30 mmHg, V_ECMO = 4 L/min, baro = 722 mmHg
    // FE_CO2 = 30/722 = 0.04155
    // VCO2 = 0.04155 * 4000 = 166.2 mL/min
    const result = bachmannVCO2ECMO(30, 4, 722);
    assert('VCO2_ECMO gas phase', result, 166.2, 0.01);
})();

(function testBachmannVCO2Lung() {
    results.innerHTML += '\n=== Bachmann: VCO2 Lung ===\n';

    // From Bachmann Eq. 2-3:
    // PetCO2 = 35 mmHg, I:E = 1:2 (I=1, E=2), V_lung = 5.6 L/min, baro = 722
    // PE_CO2 = 35 * (1+2)/2 = 52.5 mmHg
    // FE_CO2_lung = 52.5/722 = 0.0727
    // VCO2_lung = 0.0727 * 5600 = 407.1 mL/min
    const result = bachmannVCO2Lung(35, 1, 2, 5.6, 722);
    assert('VCO2_Lung gas phase', result, 407.1, 0.02);
})();

(function testBachmannQLung() {
    results.innerHTML += '\n=== Bachmann: Q_lung ===\n';

    // From Bachmann Eq. 13:
    // Q_lung = Q_ECMO * |VCO2_lung| / |VCO2_ECMO|
    // Q_ECMO = 4000 mL/min, VCO2_lung = 200, VCO2_ECMO = 100
    // Q_lung = 4000 * 200/100 = 8000 mL/min
    const result = bachmannQLung(4000, 200, 100);
    assert('Q_lung estimation', result, 8000, 1e-10);
})();

(function testNormalizationFactor() {
    results.innerHTML += '\n=== Bachmann: Normalization factor ===\n';

    // From Eq. A5/A7: f(V,Q) = (V/Q + c) / (V * (1 + c)) * Q
    // At V/Q = 1: f = (1 + 1.157) / (1 * (1 + 1.157)) = 1.0 (by design)
    // V = 4, Q = 4 (V/Q = 1), c = 1.157
    const f1 = bachmannNormFactor(4, 4, 1.157);
    assert('Norm factor at V/Q=1', f1, 1.0, 1e-6);

    // At V/Q = 2: f = (2 + 1.157) / (2 * (1 + 1.157)) = 3.157 / 4.314 = 0.7318
    // Wait, need to recalculate. f(V,Q) = Q * (V/Q + c) / (V * (1+c))
    // V=4, Q=2, V/Q=2, c=1.157
    // f = 2 * (2 + 1.157) / (4 * 2.157) = 2 * 3.157 / 8.628 = 6.314 / 8.628 = 0.7318
    const f2 = bachmannNormFactor(4, 2, 1.157);
    assert('Norm factor at V/Q=2', f2, 0.7318, 0.01);
})();

summary();
```

**Step 2: Add script tag to tests/test.html**

**Step 3: Verify tests fail**

**Step 4: Implement Bachmann calculations in js/calculations.js**

Append to `js/calculations.js`:

```js
/**
 * Calculate VCO2 at the ECMO from exhaust gas (Bachmann Eq. 1).
 * VCO2_ECMO = peCO2_ECMO * V_ECMO / baroPressure * 1000
 *
 * @param {number} peCO2 - pCO2 in ECMO exhaust gas (mmHg)
 * @param {number} vECMO - Sweep gas flow (L/min)
 * @param {number} baroPressure - Barometric pressure (mmHg)
 * @returns {number} VCO2_ECMO (mL/min)
 */
function bachmannVCO2ECMO(peCO2, vECMO, baroPressure) {
    return (peCO2 / baroPressure) * vECMO * 1000;
}

/**
 * Calculate VCO2 at the lung from end-tidal CO2 (Bachmann Eq. 2-3).
 *
 * @param {number} petCO2 - End-tidal CO2 (mmHg)
 * @param {number} inspTime - Inspiratory time (ratio component)
 * @param {number} expTime - Expiratory time (ratio component)
 * @param {number} vLung - Minute ventilation (L/min)
 * @param {number} baroPressure - Barometric pressure (mmHg)
 * @returns {number} VCO2_Lung (mL/min)
 */
function bachmannVCO2Lung(petCO2, inspTime, expTime, vLung, baroPressure) {
    const peCO2 = petCO2 * (inspTime + expTime) / expTime;
    return (peCO2 / baroPressure) * vLung * 1000;
}

/**
 * Estimate pulmonary blood flow (Bachmann Eq. 13).
 * Q_lung = Q_ECMO * |VCO2_lung| / |VCO2_ECMO|
 *
 * @param {number} qECMO - ECMO blood flow (mL/min)
 * @param {number} vco2Lung - VCO2 at lung (mL/min)
 * @param {number} vco2ECMO - VCO2 at ECMO (mL/min)
 * @returns {number} Estimated Q_lung (mL/min)
 */
function bachmannQLung(qECMO, vco2Lung, vco2ECMO) {
    return qECMO * Math.abs(vco2Lung) / Math.abs(vco2ECMO);
}

/**
 * Normalization correction factor (Bachmann Eq. A5/A7).
 * f(V,Q) = Q * (V/Q + c) / (V * (1 + c))
 *
 * @param {number} V - Sweep gas flow (L/min)
 * @param {number} Q - Blood flow (L/min)
 * @param {number} c - Empirical constant (1.157)
 * @returns {number} Correction factor f
 */
function bachmannNormFactor(V, Q, c) {
    const VQ = V / Q;
    return Q * (VQ + c) / (V * (1 + c));
}

/**
 * Normalized VCO2_ECMO (Bachmann Eq. 15).
 * VCO2_ECMO_Norm = VCO2_ECMO * f(V,Q)
 *
 * @param {number} vco2ECMO - VCO2 at ECMO (mL/min)
 * @param {number} V - Sweep gas flow (L/min)
 * @param {number} Q - Blood flow (L/min)
 * @returns {number} Normalized VCO2_ECMO (mL/min)
 */
function bachmannVCO2ECMONorm(vco2ECMO, V, Q) {
    const c = 1.157;
    const f = bachmannNormFactor(V, Q, c);
    return vco2ECMO * f;
}
```

**Step 5: Verify all tests pass**

**Step 6: Commit**

```bash
git add js/calculations.js tests/test-bachmann.js tests/test.html
git commit -m "feat: implement Bachmann cardiac output estimation with normalization"
```

---

### Task 5: Build UI — Input Panels

**Files:**
- Modify: `index.html`
- Modify: `css/style.css`

**Step 1: Build the full HTML structure**

Replace the contents of `index.html` with the complete three-panel layout including:
- Header with title and subtitle
- Panel 1: Lung IC inputs (VO2_lung, VCO2_lung)
- Panel 2: ECMO inputs (pre/post BGA side-by-side, ECMO blood flow)
- Advanced toggle section (Temperature, Hct, Hbrbc, DPG, Barometric pressure)
- Panel 3: Bachmann inputs (sweep gas, peCO2, V_lung, PetCO2, I:E ratio)
- Results section (placeholder)
- Calculate button

All input fields should have `id` attributes matching the variable names, `type="number"`, with appropriate `step`, `min`, `max`, and `placeholder` attributes.

Default values pre-filled for advanced parameters: Temp=37, Hct=0.45, Hbrbc=0.0052, DPG=4.65e-3, baroPressure=760.

**Step 2: Verify the page renders correctly in browser**

**Step 3: Commit**

```bash
git add index.html
git commit -m "feat: build input panel HTML structure"
```

---

### Task 6: Build UI — Styling

**Files:**
- Modify: `css/style.css`

**Step 1: Write CSS for the medical calculator aesthetic**

Key design decisions:
- Max-width container (900px), centered
- Cards for each panel with subtle shadows
- Two-column grid for pre/post BGA inputs side-by-side
- Large, prominent result numbers for EE
- Color-coded RQ badge (blue=fat, green=mixed, orange=carb)
- Collapsible advanced section with smooth toggle
- Responsive: single-column on mobile
- Clean typography (system fonts, good spacing)
- Calculate button: prominent, full-width
- Results section with visual hierarchy (EE largest, then VO2/VCO2, then sub-values)

**Step 2: Verify styling in browser**

**Step 3: Commit**

```bash
git add css/style.css
git commit -m "feat: add medical calculator styling"
```

---

### Task 7: Wire Up — App Logic

**Files:**
- Modify: `js/app.js`

**Step 1: Implement the app controller**

```js
document.addEventListener('DOMContentLoaded', function() {
    // Toggle advanced parameters
    const advToggle = document.getElementById('advancedToggle');
    const advSection = document.getElementById('advancedSection');
    if (advToggle) {
        advToggle.addEventListener('click', function() {
            advSection.classList.toggle('collapsed');
            advToggle.textContent = advSection.classList.contains('collapsed')
                ? 'Show Advanced Parameters'
                : 'Hide Advanced Parameters';
        });
    }

    // Toggle Bachmann section
    const bachToggle = document.getElementById('bachmannToggle');
    const bachSection = document.getElementById('bachmannSection');
    if (bachToggle) {
        bachToggle.addEventListener('click', function() {
            bachSection.classList.toggle('collapsed');
            bachToggle.textContent = bachSection.classList.contains('collapsed')
                ? 'Show Cardiac Output Estimation'
                : 'Hide Cardiac Output Estimation';
        });
    }

    // Calculate button
    document.getElementById('calculateBtn').addEventListener('click', calculate);

    function getVal(id) {
        return parseFloat(document.getElementById(id).value);
    }

    function calculate() {
        // Gather inputs
        const params = {
            pre: {
                pO2: getVal('prePO2'),
                pCO2: getVal('prePCO2'),
                pH_plasma: getVal('prepH')
            },
            post: {
                pO2: getVal('postPO2'),
                pCO2: getVal('postPCO2'),
                pH_plasma: getVal('postpH')
            },
            ecmoFlow: getVal('ecmoFlow'),
            vo2Lung: getVal('vo2Lung'),
            vco2Lung: getVal('vco2Lung'),
            Temp: getVal('temperature'),
            Hct: getVal('hematocrit'),
            Hbrbc: getVal('hbrbc'),
            DPGrbc: getVal('dpg'),
            baroPressure: getVal('baroPressure')
        };

        // Validate required fields
        const required = [params.pre.pO2, params.pre.pCO2, params.pre.pH_plasma,
                         params.post.pO2, params.post.pCO2, params.post.pH_plasma,
                         params.ecmoFlow, params.vo2Lung, params.vco2Lung];
        if (required.some(isNaN)) {
            alert('Please fill in all required fields.');
            return;
        }

        // Run MEEP calculation
        const result = calculateMEEP(params);

        // Display results
        displayResults(result);

        // Bachmann calculations if inputs are provided
        const sweepFlow = getVal('sweepFlow');
        const peCO2 = getVal('peCO2');
        const vLung = getVal('vLung');
        const petCO2 = getVal('petCO2');
        const inspTime = getVal('inspTime');
        const expTime = getVal('expTime');

        if (!isNaN(sweepFlow) && !isNaN(peCO2) && !isNaN(vLung) && !isNaN(petCO2) && !isNaN(inspTime) && !isNaN(expTime)) {
            const bach = calculateBachmann(params, sweepFlow, peCO2, vLung, petCO2, inspTime, expTime);
            displayBachmannResults(bach);
        }
    }

    function calculateBachmann(params, sweepFlow, peCO2, vLung, petCO2, inspTime, expTime) {
        const baro = params.baroPressure;
        const vco2ECMOGas = bachmannVCO2ECMO(peCO2, sweepFlow, baro);
        const vco2LungGas = bachmannVCO2Lung(petCO2, inspTime, expTime, vLung, baro);
        const qECMO = params.ecmoFlow * 1000; // convert L/min to mL/min
        const qLung = bachmannQLung(qECMO, vco2LungGas, vco2ECMOGas);
        const normFactor = bachmannNormFactor(sweepFlow, params.ecmoFlow, 1.157);
        const vco2ECMONorm = bachmannVCO2ECMONorm(vco2ECMOGas, sweepFlow, params.ecmoFlow);

        return {
            vco2ECMOGas,
            vco2LungGas,
            qLung,
            normFactor,
            vco2ECMONorm
        };
    }

    function displayResults(result) {
        document.getElementById('resVO2ECMO').textContent = result.vo2ECMO.toFixed(1);
        document.getElementById('resVCO2ECMO').textContent = result.vco2ECMO.toFixed(1);
        document.getElementById('resVO2Total').textContent = result.vo2Total.toFixed(1);
        document.getElementById('resVCO2Total').textContent = result.vco2Total.toFixed(1);
        document.getElementById('resRQ').textContent = result.rq.toFixed(2);
        document.getElementById('resEE').textContent = result.ee.toFixed(0);

        // Sub-values
        document.getElementById('resPreO2').textContent = result.preO2cont.toFixed(2);
        document.getElementById('resPreCO2').textContent = result.preCO2cont.toFixed(2);
        document.getElementById('resPostO2').textContent = result.postO2cont.toFixed(2);
        document.getElementById('resPostCO2').textContent = result.postCO2cont.toFixed(2);
        document.getElementById('resPreSat').textContent = (result.preSHbO2 * 100).toFixed(1);
        document.getElementById('resPostSat').textContent = (result.postSHbO2 * 100).toFixed(1);

        // RQ color coding
        const rqBadge = document.getElementById('rqBadge');
        if (result.rq < 0.75) {
            rqBadge.className = 'rq-badge rq-fat';
            rqBadge.textContent = 'Fat oxidation';
        } else if (result.rq < 0.85) {
            rqBadge.className = 'rq-badge rq-mixed';
            rqBadge.textContent = 'Mixed substrate';
        } else if (result.rq <= 1.0) {
            rqBadge.className = 'rq-badge rq-carb';
            rqBadge.textContent = 'Carbohydrate';
        } else {
            rqBadge.className = 'rq-badge rq-lipogenesis';
            rqBadge.textContent = 'Lipogenesis / overfeeding';
        }

        document.getElementById('resultsSection').classList.remove('hidden');
    }

    function displayBachmannResults(bach) {
        document.getElementById('resQLung').textContent = bach.qLung.toFixed(0);
        document.getElementById('resVCO2ECMOGas').textContent = bach.vco2ECMOGas.toFixed(1);
        document.getElementById('resVCO2LungGas').textContent = bach.vco2LungGas.toFixed(1);
        document.getElementById('resNormFactor').textContent = bach.normFactor.toFixed(3);
        document.getElementById('resVCO2ECMONorm').textContent = bach.vco2ECMONorm.toFixed(1);
        document.getElementById('bachmannResults').classList.remove('hidden');
    }
});
```

**Step 2: Verify full app works end-to-end in browser**

Test with known values:
- Pre-membrane: pO2=40, pCO2=46, pH=7.35
- Post-membrane: pO2=300, pCO2=35, pH=7.40
- ECMO flow=3.5, VO2_lung=50, VCO2_lung=40

**Step 3: Commit**

```bash
git add js/app.js
git commit -m "feat: wire up app logic connecting inputs to calculations and results display"
```

---

### Task 8: Integration Testing & Polish

**Files:**
- Modify: `index.html` (minor tweaks)
- Modify: `css/style.css` (final polish)
- Modify: `js/app.js` (input validation, edge cases)

**Step 1: Test edge cases**

- Zero ECMO flow
- Very high pO2 (>500 mmHg post-oxygenator)
- Low pH (<7.0)
- Missing optional fields (Bachmann inputs empty should not error)

**Step 2: Add input validation feedback**

Highlight invalid/missing fields with red border instead of alert().

**Step 3: Add a "Reset" button to clear all fields**

**Step 4: Add reference citation footer**

Add small footer text citing:
- Wollersheim et al. (MEEP protocol)
- Dash & Bassingthwaighte (blood gas model)
- Bachmann et al. (cardiac output estimation)
- Weir equation

**Step 5: Final visual verification in browser**

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: integration testing, input validation, and final polish"
```

---

## Task Summary

| Task | Description | Est. |
|------|-------------|------|
| 1 | Project scaffolding + test harness | 3 min |
| 2 | Port Dash model to JS + tests | 10 min |
| 3 | MEEP calculation pipeline + tests | 5 min |
| 4 | Bachmann cardiac output + tests | 5 min |
| 5 | UI input panels (HTML) | 5 min |
| 6 | CSS styling | 5 min |
| 7 | App logic (wire up) | 5 min |
| 8 | Integration testing + polish | 5 min |

**Dependencies:** Tasks 1→2→3→4 are sequential (computation builds on each). Tasks 5-6 are independent of 3-4. Task 7 requires all prior tasks. Task 8 requires Task 7.
