// === MEEP Calculation Pipeline Tests ===

(function testWeirEquation() {
    results.innerHTML += '\n=== Weir Equation ===\n';
    // VO2=250, VCO2=200: EE = (3.9*250 + 1.1*200) * 1.44 = (975+220)*1.44 = 1720.8
    assert('Weir standard', weirEquation(250, 200), 1720.8, 1e-10);

    // VO2=300, VCO2=240: EE = (3.9*300 + 1.1*240) * 1.44 = (1170+264)*1.44 = 2064.96
    assert('Weir higher metabolism', weirEquation(300, 240), 2064.96, 1e-10);
})();

(function testPlasmapHConversion() {
    results.innerHTML += '\n=== Plasma pH to RBC pH ===\n';
    // pH_plasma = 7.40 → pHrbc = 7.40 + log10(0.69) = 7.40 + (-0.1612) = 7.2388
    const pHrbc = plasmapHToRBCpH(7.40);
    assert('pH conversion 7.40', pHrbc, 7.40 + Math.log10(0.69), 1e-10);

    // At standard: pH_plasma ~ 7.4015 gives pHrbc = 7.24
    assert('pH conversion gives ~7.24', plasmapHToRBCpH(7.4015), 7.24, 0.002);
})();

(function testMEEPCalculation() {
    results.innerHTML += '\n=== MEEP Calculation Pipeline ===\n';

    const params = {
        pre: { pO2: 40, pCO2: 46, pH_plasma: 7.35 },
        post: { pO2: 300, pCO2: 35, pH_plasma: 7.40 },
        ecmoFlow: 3.5,
        vo2Lung: 50,
        vco2Lung: 40,
        Temp: 37,
        Hct: 0.45,
        Hbrbc: 0.0052,
        DPGrbc: 4.65e-3,
        baroPressure: 760
    };

    const result = calculateMEEP(params);

    // VO2_ECMO should be positive (O2 gained across membrane)
    assert('VO2_ECMO positive', result.vo2ECMO > 0, true);

    // VCO2_ECMO should be positive (CO2 removed across membrane)
    assert('VCO2_ECMO positive', result.vco2ECMO > 0, true);

    // Totals = lung + ECMO
    assert('VO2_total = lung + ECMO', result.vo2Total, params.vo2Lung + result.vo2ECMO, 1e-10);
    assert('VCO2_total = lung + ECMO', result.vco2Total, params.vco2Lung + result.vco2ECMO, 1e-10);

    // RQ between 0.5 and 1.5
    assert('RQ reasonable', result.rq > 0.5 && result.rq < 1.5, true);

    // EE matches Weir equation
    const expectedEE = (3.9 * result.vo2Total + 1.1 * result.vco2Total) * 1.44;
    assert('EE matches Weir', result.ee, expectedEE, 1e-10);

    // EE reasonable for ICU patient
    assert('EE in range 500-5000', result.ee > 500 && result.ee < 5000, true);

    // Blood gas contents should be physiological
    assert('Pre O2 content 10-18', result.preO2cont > 10 && result.preO2cont < 18, true);
    assert('Post O2 content > 20', result.postO2cont > 20, true);
    assert('Pre CO2 > Post CO2', result.preCO2cont > result.postCO2cont, true);
})();
