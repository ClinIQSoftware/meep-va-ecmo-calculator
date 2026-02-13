# VA ECMO Oxygen Consumption & Energy Expenditure Calculator — Design Document

**Date:** 2026-02-12
**Status:** Approved

## Overview

A single-page web application that implements the MEEP protocol (Wollersheim et al., 2017) for calculating total oxygen consumption (VO2), CO2 elimination (VCO2), and energy expenditure (EE) in patients on VA ECMO. Includes Bachmann et al. (2020) cardiac output estimation from gas exchange data.

## Problem

In VA ECMO, gas exchange occurs at two sites: the native lungs and the ECMO membrane oxygenator. Conventional indirect calorimetry (IC) only measures lung gas exchange, underestimating true VO2/VCO2 and making energy expenditure calculations inaccurate.

## Solution

Combine lung IC measurements with calculated ECMO membrane gas exchange (using the Dash & Bassingthwaighte blood gas content model) to derive total VO2/VCO2, then compute EE via the Weir equation.

## Architecture

- **Platform:** Single-page web app (HTML/CSS/JS), no frameworks, no build tools
- **Deployment:** Can be opened from file system or hosted on any static server
- **Core engine:** Dash & Bassingthwaighte `SHbO2CO2_EJAP2016` model ported from MATLAB to JavaScript

## Computation Pipeline

1. Run Dash model on **pre-membrane** blood gas → O2/CO2 content (mL/100mL blood)
2. Run Dash model on **post-membrane** blood gas → O2/CO2 content (mL/100mL blood)
3. VO2_ECMO = (O2_content_post - O2_content_pre) × ECMO_blood_flow(L/min) × 10
4. VCO2_ECMO = (CO2_content_pre - CO2_content_post) × ECMO_blood_flow(L/min) × 10
5. VO2_total = VO2_lung + VO2_ECMO
6. VCO2_total = VCO2_lung + VCO2_ECMO
7. RQ = VCO2_total / VO2_total
8. **EE (kcal/d) = (3.9 × VO2_total + 1.1 × VCO2_total) × 1.44** (Weir equation)

## Dash & Bassingthwaighte Model (SHbO2CO2_EJAP2016)

Faithful JavaScript port of the MATLAB function. Inputs:
- pO2 (mmHg), pCO2 (mmHg), pHrbc, DPGrbc (M), Temp (°C), Hbrbc (M), Hct

Outputs:
- SHbO2, SHbCO2 (hemoglobin saturations)
- O2 content, CO2 content (mL O2 or CO2 per 100 mL blood)
- P50, alphaO2, alphaCO2, and intermediate variables

Key features preserved from MATLAB:
- Variable Hill coefficient: nH = 2.8 - 1.2 × 10^(-pO2/29.2)
- P50 corrections for pH, CO2, DPG, and temperature
- Binding polynomial calculations for KHbO2 and KHbCO2
- CO2 content including dissolved, bicarbonate, and Hb-bound fractions

## User Interface

### Panel 1: Lung Measurements (from IC)
| Input | Units | Notes |
|-------|-------|-------|
| VO2_lung | mL/min | From indirect calorimeter |
| VCO2_lung | mL/min | From indirect calorimeter |

### Panel 2: ECMO Membrane Calculations
| Input | Units | Notes |
|-------|-------|-------|
| **Pre-membrane BGA** | | |
| pO2_pre | mmHg | |
| pCO2_pre | mmHg | |
| pH_pre | | Plasma pH |
| **Post-membrane BGA** | | |
| pO2_post | mmHg | |
| pCO2_post | mmHg | |
| pH_post | | Plasma pH |
| ECMO blood flow | L/min | From ECMO console |

### Advanced Parameters (collapsed by default)
| Input | Units | Default | Notes |
|-------|-------|---------|-------|
| Temperature | °C | 37 | Patient temperature |
| Hematocrit | fraction | 0.45 | From BGA |
| Hb in RBCs | M | 0.0052 | ~21.4 mM × Hct factor |
| 2,3-DPG | M | 4.65e-3 | Standard value |
| Barometric pressure | mmHg | 760 | Local altitude adjustment |

Note: pH_rbc is calculated from pH_plasma using Gibbs-Donnan ratio (Rrbc = 0.69):
pHrbc = pHplasma + log10(0.69)

### Panel 3: Results Dashboard
- VO2_ECMO, VCO2_ECMO (mL/min)
- VO2_total, VCO2_total (mL/min)
- RQ with clinical interpretation
- **Energy Expenditure (kcal/day)** — prominently displayed

## Bachmann Cardiac Output Estimation

### Additional Inputs
| Input | Units | Notes |
|-------|-------|-------|
| V_ECMO (sweep gas flow) | L/min | From ECMO console |
| peCO2_ECMO | mmHg | CO2 in ECMO exhaust gas |
| V_lung (minute ventilation) | L/min | From ventilator |
| PetCO2_lung | mmHg | End-tidal CO2 |
| I:E ratio | ratio | Ventilator setting |

### Calculations
1. VCO2_ECMO = (peCO2_ECMO × V_ECMO) / barometric_pressure × 1000
2. PE_CO2 = PetCO2 × (I+E)/E
3. VCO2_lung = (PE_CO2 × V_lung) / barometric_pressure × 1000
4. Q_lung = Q_ECMO × |VCO2_lung| / |VCO2_ECMO|
5. VCO2_ECMO_Norm = VCO2_ECMO × f(V,Q) where:
   - f(V,Q) = Q × (V/Q + c) / (V × (1 + c))
   - c = 1.157 (empirically derived)

### Outputs
- Estimated Q_lung (mL/min)
- VCO2_ECMO_Norm (mL/min)
- Normalization correction factor f

## Visual Design
- Clean medical calculator aesthetic
- White background, clear section headers
- Large prominent result numbers
- Color-coded RQ interpretation (0.7 = fat oxidation → 1.0 = carbohydrate)
- Responsive layout for desktop and tablet use

## References
1. Wollersheim et al. "MEEP Protocol" Clinical Nutrition 2018;37(1):301-307
2. Dash & Bassingthwaighte. ABME 38(4):1683-1701, 2010 (revised 2016)
3. Bachmann et al. Am J Physiol Lung Cell Mol Physiol 318:L1211-L1221, 2020
4. Weir JB. "New methods for calculating metabolic rate" J Physiol 1949
