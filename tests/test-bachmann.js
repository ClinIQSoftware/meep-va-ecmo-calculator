// === Bachmann Cardiac Output Estimation Tests ===

(function testBachmannVCO2ECMO() {
    results.innerHTML += '\n=== Bachmann: VCO2 from ECMO exhaust ===\n';
    // peCO2=30 mmHg, V_ECMO=4 L/min, baro=722 mmHg
    // VCO2 = (30/722) * 4 * 1000 = 166.20 mL/min
    const result = bachmannVCO2ECMO(30, 4, 722);
    assert('VCO2_ECMO gas phase', result, (30 / 722) * 4 * 1000, 1e-10);
})();

(function testBachmannVCO2Lung() {
    results.innerHTML += '\n=== Bachmann: VCO2 Lung ===\n';
    // PetCO2=35, I:E=1:2, V_lung=5.6 L/min, baro=722
    // PE_CO2 = 35 * (1+2)/2 = 52.5
    // VCO2 = (52.5/722) * 5.6 * 1000 = 407.20 mL/min
    const result = bachmannVCO2Lung(35, 1, 2, 5.6, 722);
    const expected = (35 * 3 / 2 / 722) * 5.6 * 1000;
    assert('VCO2_Lung gas phase', result, expected, 1e-10);
})();

(function testBachmannQLung() {
    results.innerHTML += '\n=== Bachmann: Q_lung estimation ===\n';
    // Q_ECMO=4000 mL/min, VCO2_lung=200, VCO2_ECMO=100
    // Q_lung = 4000 * 200/100 = 8000
    assert('Q_lung basic', bachmannQLung(4000, 200, 100), 8000, 1e-10);

    // Edge: equal VCO2 → Q_lung = Q_ECMO
    assert('Q_lung equal VCO2', bachmannQLung(3000, 150, 150), 3000, 1e-10);
})();

(function testNormalizationFactor() {
    results.innerHTML += '\n=== Bachmann: Normalization factor ===\n';
    // At V/Q=1: f should be 1.0
    assert('f at V/Q=1', bachmannNormFactor(4, 4, 1.157), 1.0, 1e-6);

    // At V/Q=2: f = Q*(V/Q+c) / (V*(1+c)) = 2*(2+1.157) / (4*2.157) = 6.314/8.628
    const f2 = bachmannNormFactor(4, 2, 1.157);
    assert('f at V/Q=2', f2, 2 * (2 + 1.157) / (4 * 2.157), 1e-6);

    // At V/Q=0.5: f = Q*(0.5+1.157) / (V*(1+1.157)) = 4*(0.5+1.157) / (2*2.157)
    const f05 = bachmannNormFactor(2, 4, 1.157);
    assert('f at V/Q=0.5', f05, 4 * (0.5 + 1.157) / (2 * 2.157), 1e-6);
})();

(function testVCO2Normalization() {
    results.innerHTML += '\n=== Bachmann: VCO2 Normalization ===\n';
    // At V/Q=1, normalized = original
    const norm1 = bachmannVCO2ECMONorm(200, 4, 4);
    assert('VCO2Norm at V/Q=1', norm1, 200, 1e-6);

    // At V/Q != 1, normalized differs
    const norm2 = bachmannVCO2ECMONorm(200, 4, 2);
    assert('VCO2Norm at V/Q=2 < original', norm2 < 200, true);
})();

summary();
