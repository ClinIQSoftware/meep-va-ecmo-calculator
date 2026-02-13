// === Dash & Bassingthwaighte Model Tests ===

// Test 1: Standard physiological conditions (arterial blood)
(function testStandardConditions() {
    results.innerHTML += '\n=== Dash Model: Standard Conditions ===\n';
    const input = {
        pO2: 100,        // mmHg (arterial)
        pCO2: 40,        // mmHg
        pHrbc: 7.24,     // standard RBC pH
        DPGrbc: 4.65e-3, // M
        Temp: 37,        // degC
        Hbrbc: 0.0052,   // M
        Hct: 0.45
    };
    const output = SHbO2CO2(input);

    // P50 at standard conditions = 26.8 mmHg (all deltas = 0)
    assert('P50 at standard', output.P50, 26.8, 1e-4);

    // alphaO2 at 37C = 1.46e-6 (no temp correction)
    assert('alphaO2 at 37C', output.alphaO2, 1.46e-6, 1e-6);

    // alphaCO2 at 37C = 32.66e-6
    assert('alphaCO2 at 37C', output.alphaCO2, 32.66e-6, 1e-6);

    // SHbO2 at pO2=100 ~0.974 (normal arterial)
    assert('SHbO2 arterial', output.SHbO2, 0.974, 5e-3);

    // O2 content ~20 mL/100mL (typical arterial)
    assert('O2cont arterial range', output.O2cont > 15 && output.O2cont < 25, true);

    // CO2 content with bicarb ~45-55 mL/100mL (typical arterial)
    assert('CO2cont2 arterial range', output.CO2cont2 > 40 && output.CO2cont2 < 60, true);

    // Variable Hill coefficient at pO2=100
    // nH = 2.8 - 1.2 * 10^(-100/29.2) = 2.8 - 1.2 * 10^(-3.425) ≈ 2.8 - 0.00045 ≈ 2.7996
    assert('nH at pO2=100', output.nH, 2.8, 0.01);
})();

// Test 2: Venous blood
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

    // SHbO2 at pO2=40 ~0.73 (mixed venous saturation)
    assert('SHbO2 venous ~73%', output.SHbO2, 0.73, 0.05);

    // O2 content venous ~15 mL/100mL
    assert('O2cont venous range', output.O2cont > 10 && output.O2cont < 18, true);

    // CO2 content higher than arterial
    assert('CO2cont2 venous > 45', output.CO2cont2 > 45, true);
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
    assert('SHbO2 post-oxy ~100%', output.SHbO2, 1.0, 0.01);

    // O2 content higher than arterial due to dissolved O2
    assert('O2cont post-oxy > 20', output.O2cont > 20, true);

    // CO2 content lower (less CO2 post-membrane)
    assert('CO2cont2 post-oxy < arterial', output.CO2cont2 < 55, true);
})();

// Test 4: Temperature effect on solubility
(function testTemperatureEffect() {
    results.innerHTML += '\n=== Dash Model: Temperature Effects ===\n';
    const base = {
        pO2: 100, pCO2: 40, pHrbc: 7.24,
        DPGrbc: 4.65e-3, Hbrbc: 0.0052, Hct: 0.45
    };

    const at37 = SHbO2CO2({ ...base, Temp: 37 });
    const at33 = SHbO2CO2({ ...base, Temp: 33 });

    // Hypothermia: O2 solubility increases, P50 decreases (left shift)
    assert('alphaO2 higher at 33C', at33.alphaO2 > at37.alphaO2, true);
    assert('P50 lower at 33C (left shift)', at33.P50 < at37.P50, true);
})();
