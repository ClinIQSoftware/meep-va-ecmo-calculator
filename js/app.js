document.addEventListener('DOMContentLoaded', function () {
    // --- Toggle handlers ---
    setupToggle('advancedToggle', 'advancedSection');
    setupToggle('bachmannToggle', 'bachmannSection');

    function setupToggle(btnId, sectionId) {
        var btn = document.getElementById(btnId);
        var section = document.getElementById(sectionId);
        if (!btn || !section) return;
        btn.addEventListener('click', function () {
            var isCollapsed = section.classList.toggle('collapsed');
            btn.classList.toggle('active', !isCollapsed);
        });
    }

    // --- Calculate ---
    document.getElementById('calculateBtn').addEventListener('click', calculate);

    // Allow Enter key to trigger calculation from any input
    document.querySelectorAll('input[type="number"]').forEach(function (input) {
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') calculate();
        });
    });

    // --- Reset ---
    document.getElementById('resetBtn').addEventListener('click', function () {
        // Clear non-default inputs
        var defaultIds = { temperature: '37', hematocrit: '0.45', hbrbc: '0.0052', dpg: '0.00465', baroPressure: '760' };
        document.querySelectorAll('input[type="number"]').forEach(function (input) {
            if (defaultIds[input.id] !== undefined) {
                input.value = defaultIds[input.id];
            } else {
                input.value = '';
            }
            input.closest('.input-wrap').classList.remove('error');
        });
        document.getElementById('resultsSection').classList.add('hidden');
        document.getElementById('bachmannResults').classList.add('hidden');
    });

    function getVal(id) {
        return parseFloat(document.getElementById(id).value);
    }

    function markError(id, hasError) {
        var wrap = document.getElementById(id).closest('.input-wrap');
        if (hasError) {
            wrap.classList.add('error');
        } else {
            wrap.classList.remove('error');
        }
    }

    function calculate() {
        // Clear previous errors
        document.querySelectorAll('.input-wrap.error').forEach(function (el) {
            el.classList.remove('error');
        });

        // Gather primary inputs
        var requiredFields = ['vo2Lung', 'vco2Lung', 'prePO2', 'prePCO2', 'prepH', 'postPO2', 'postPCO2', 'postpH', 'ecmoFlow'];
        var hasError = false;

        requiredFields.forEach(function (id) {
            var val = getVal(id);
            if (isNaN(val)) {
                markError(id, true);
                hasError = true;
            }
        });

        if (hasError) return;

        var params = {
            pre: { pO2: getVal('prePO2'), pCO2: getVal('prePCO2'), pH_plasma: getVal('prepH') },
            post: { pO2: getVal('postPO2'), pCO2: getVal('postPCO2'), pH_plasma: getVal('postpH') },
            ecmoFlow: getVal('ecmoFlow'),
            vo2Lung: getVal('vo2Lung'),
            vco2Lung: getVal('vco2Lung'),
            Temp: getVal('temperature'),
            Hct: getVal('hematocrit'),
            Hbrbc: getVal('hbrbc'),
            DPGrbc: getVal('dpg'),
            baroPressure: getVal('baroPressure')
        };

        // Run MEEP calculation
        var result = calculateMEEP(params);
        displayResults(result);

        // Bachmann (optional)
        var sweepFlow = getVal('sweepFlow');
        var peCO2 = getVal('peCO2');
        var vLung = getVal('vLung');
        var petCO2 = getVal('petCO2');
        var inspTime = getVal('inspTime');
        var expTime = getVal('expTime');

        if (!isNaN(sweepFlow) && !isNaN(peCO2) && !isNaN(vLung) &&
            !isNaN(petCO2) && !isNaN(inspTime) && !isNaN(expTime) &&
            sweepFlow > 0 && peCO2 > 0 && expTime > 0) {
            var bach = computeBachmann(params, sweepFlow, peCO2, vLung, petCO2, inspTime, expTime);
            displayBachmannResults(bach);
        } else {
            document.getElementById('bachmannResults').classList.add('hidden');
        }
    }

    function computeBachmann(params, sweepFlow, peCO2, vLung, petCO2, inspTime, expTime) {
        var baro = params.baroPressure;
        var vco2ECMOGas = bachmannVCO2ECMO(peCO2, sweepFlow, baro);
        var vco2LungGas = bachmannVCO2Lung(petCO2, inspTime, expTime, vLung, baro);
        var qECMO = params.ecmoFlow * 1000;
        var qLung = bachmannQLung(qECMO, vco2LungGas, vco2ECMOGas);
        var normFactor = bachmannNormFactor(sweepFlow, params.ecmoFlow, 1.157);
        var vco2ECMONorm = bachmannVCO2ECMONorm(vco2ECMOGas, sweepFlow, params.ecmoFlow);

        return {
            vco2ECMOGas: vco2ECMOGas,
            vco2LungGas: vco2LungGas,
            qLung: qLung,
            normFactor: normFactor,
            vco2ECMONorm: vco2ECMONorm
        };
    }

    function displayResults(result) {
        setText('resEE', result.ee.toFixed(0));
        setText('resRQ', result.rq.toFixed(2));
        setText('resVO2ECMO', result.vo2ECMO.toFixed(1));
        setText('resVCO2ECMO', result.vco2ECMO.toFixed(1));
        setText('resVO2Total', result.vo2Total.toFixed(1));
        setText('resVCO2Total', result.vco2Total.toFixed(1));

        setText('resPreO2', result.preO2cont.toFixed(2));
        setText('resPreCO2', result.preCO2cont.toFixed(2));
        setText('resPostO2', result.postO2cont.toFixed(2));
        setText('resPostCO2', result.postCO2cont.toFixed(2));
        setText('resPreSat', (result.preSHbO2 * 100).toFixed(1));
        setText('resPostSat', (result.postSHbO2 * 100).toFixed(1));

        // Timestamp
        var now = new Date();
        setText('resTimestamp', now.toLocaleTimeString());

        // RQ badge
        var badge = document.getElementById('rqBadge');
        var rq = result.rq;
        if (rq < 0.75) {
            badge.className = 'rq-badge rq-fat';
            badge.textContent = 'Fat oxidation';
        } else if (rq < 0.85) {
            badge.className = 'rq-badge rq-mixed';
            badge.textContent = 'Mixed substrate';
        } else if (rq <= 1.0) {
            badge.className = 'rq-badge rq-carb';
            badge.textContent = 'Carbohydrate';
        } else {
            badge.className = 'rq-badge rq-lipogenesis';
            badge.textContent = 'Lipogenesis';
        }

        document.getElementById('resultsSection').classList.remove('hidden');
    }

    function displayBachmannResults(bach) {
        setText('resQLung', bach.qLung.toFixed(0));
        setText('resVCO2ECMOGas', bach.vco2ECMOGas.toFixed(1));
        setText('resVCO2LungGas', bach.vco2LungGas.toFixed(1));
        setText('resNormFactor', bach.normFactor.toFixed(3));
        setText('resVCO2ECMONorm', bach.vco2ECMONorm.toFixed(1));
        document.getElementById('bachmannResults').classList.remove('hidden');
    }

    function setText(id, value) {
        document.getElementById(id).textContent = value;
    }
});
