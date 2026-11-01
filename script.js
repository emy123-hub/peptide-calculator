/**
 * Peptide Reconstitution Calculator
 * Core logic, input synchronization, safety guards, and SVG visual syringe
 */

(function () {
  'use strict';

  // DOM Elements - Inputs
  const peptideSelect = document.getElementById('peptide-select');
  const vialMgInput = document.getElementById('vial-mg');
  const bacWaterInput = document.getElementById('bac-water');
  const desiredDoseInput = document.getElementById('desired-dose');
  const doseHelper = document.getElementById('dose-helper');
  const toggleMcg = document.getElementById('toggle-mcg');
  const toggleMg = document.getElementById('toggle-mg');
  const doseUnitLabel = document.getElementById('dose-unit-label');
  const syringeSelect = document.getElementById('syringe-size');
  const frequencySelect = document.getElementById('frequency');
  const mixDateInput = document.getElementById('mix-date');
  const btnReset = document.getElementById('btn-reset');
  const presetButtons = document.querySelectorAll('.preset-btn');

  // DOM Elements - States & Containers
  const emptyState = document.getElementById('empty-state');
  const resultsContainer = document.getElementById('results-container');
  const checkVial = document.getElementById('check-vial');
  const checkWater = document.getElementById('check-water');
  const checkDose = document.getElementById('check-dose');

  // DOM Elements - Output Metrics
  const outUnits = document.getElementById('out-units');
  const outSubUnits = document.getElementById('out-sub-units');
  const outVolumeMl = document.getElementById('out-volume-ml');
  const fractionNote = document.getElementById('fraction-note');
  const outMetricMl = document.getElementById('out-metric-ml');
  const outConcentrationMg = document.getElementById('out-concentration-mg');
  const outConcentrationMcg = document.getElementById('out-concentration-mcg');
  const outMcgPerUnit = document.getElementById('out-mcg-per-unit');
  const outDosesPerVial = document.getElementById('out-doses-per-vial');
  const syringeCalLabel = document.getElementById('syringe-cal-label');

  // DOM Elements - Protocol / Optional Outputs
  const protocolStatsBox = document.getElementById('protocol-stats-box');
  const statDurationWrap = document.getElementById('stat-duration-wrap');
  const outLifespanDays = document.getElementById('out-lifespan-days');
  const statDiscardWrap = document.getElementById('stat-discard-wrap');
  const outDiscardDate = document.getElementById('out-discard-date');

  // DOM Elements - Warnings
  const warnOvercapacity = document.getElementById('warn-overcapacity');
  const overcapacityUnits = document.getElementById('overcapacity-units');
  const overcapacityMl = document.getElementById('overcapacity-ml');
  const overcapacityMax = document.getElementById('overcapacity-max');

  const warnMistakeGuard = document.getElementById('warn-mistake-guard');
  const mistakeDoseVal = document.getElementById('mistake-dose-val');
  const mistakeMcgFix = document.getElementById('mistake-mcg-fix');
  const btnFixUnit = document.getElementById('btn-fix-unit');

  const warnLowVolume = document.getElementById('warn-low-volume');
  const warnExpiry = document.getElementById('warn-expiry');

  // DOM Elements - Visual Syringe
  const syringeSvgContainer = document.getElementById('syringe-svg-container');
  const magnifierContainer = document.getElementById('magnifier-container');

  // State
  let currentDoseUnit = 'mcg'; // Default toggle

  // --- Initial Setup ---
  function init() {
    setupEventListeners();
    updateChecklist();
  }

  function setupEventListeners() {
    // Peptide select dropdown
    if (peptideSelect) {
      peptideSelect.addEventListener('change', onPeptideSelected);
    }

    // Number inputs
    vialMgInput.addEventListener('input', onInputChanged);
    bacWaterInput.addEventListener('input', onInputChanged);
    desiredDoseInput.addEventListener('input', onDoseInputChanged);

    // Dose Unit Toggle (mcg / mg)
    toggleMcg.addEventListener('click', () => setDoseUnit('mcg'));
    toggleMg.addEventListener('click', () => setDoseUnit('mg'));

    // Syringe select
    syringeSelect.addEventListener('change', onInputChanged);

    // Optional Protocol inputs
    frequencySelect.addEventListener('change', onInputChanged);
    mixDateInput.addEventListener('change', onInputChanged);

    // Preset buttons
    presetButtons.forEach(btn => {
      btn.addEventListener('click', onPresetClicked);
    });

    // Reset button
    btnReset.addEventListener('click', resetCalculator);

    // Mistake Guard fix button
    btnFixUnit.addEventListener('click', onFixUnitClicked);
  }

  // --- Peptide Select Handler (Never pre-fills dose!) ---
  function onPeptideSelected() {
    const selectedOption = peptideSelect.options[peptideSelect.selectedIndex];
    if (selectedOption && selectedOption.value) {
      const vial = selectedOption.getAttribute('data-vial');
      const water = selectedOption.getAttribute('data-water');

      if (vial) {
        vialMgInput.value = vial;
        syncPresetButtons('vial-mg', vial);
      }
      if (water) {
        bacWaterInput.value = water;
        syncPresetButtons('bac-water', water);
      }
      // Note: Desired dose is NEVER auto-filled per PRD safety rule
    }
    onInputChanged();
  }

  // --- Preset Button Click Handler ---
  function onPresetClicked(e) {
    const btn = e.currentTarget;
    const targetInputId = btn.getAttribute('data-input');
    const val = btn.getAttribute('data-val');
    const input = document.getElementById(targetInputId);

    if (input) {
      input.value = val;
      syncPresetButtons(targetInputId, val);
      onInputChanged();
    }
  }

  function syncPresetButtons(inputId, val) {
    const buttons = document.querySelectorAll(`.preset-btn[data-input="${inputId}"]`);
    buttons.forEach(btn => {
      if (parseFloat(btn.getAttribute('data-val')) === parseFloat(val)) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // --- Dose Unit Toggle Handler ---
  function setDoseUnit(unit) {
    if (currentDoseUnit === unit) return;
    currentDoseUnit = unit;

    if (unit === 'mcg') {
      toggleMcg.classList.add('active');
      toggleMcg.setAttribute('aria-checked', 'true');
      toggleMg.classList.remove('active');
      toggleMg.setAttribute('aria-checked', 'false');
      doseUnitLabel.textContent = 'mcg';
      desiredDoseInput.placeholder = 'Enter dose (e.g. 250)';
    } else {
      toggleMg.classList.add('active');
      toggleMg.setAttribute('aria-checked', 'true');
      toggleMcg.classList.remove('active');
      toggleMcg.setAttribute('aria-checked', 'false');
      doseUnitLabel.textContent = 'mg';
      desiredDoseInput.placeholder = 'Enter dose (e.g. 0.25)';
    }

    updateDoseHelper();
    onInputChanged();
  }

  function updateDoseHelper() {
    const val = parseFloat(desiredDoseInput.value);
    if (!val || val <= 0) {
      doseHelper.textContent = '';
      return;
    }

    if (currentDoseUnit === 'mcg') {
      const mgVal = val / 1000;
      doseHelper.innerHTML = `<span><strong>${formatNumber(val)} mcg</strong> = ${formatNumber(mgVal, 4)} mg</span>`;
    } else {
      const mcgVal = val * 1000;
      doseHelper.innerHTML = `<span><strong>${formatNumber(val)} mg</strong> = ${formatNumber(mcgVal, 2)} mcg</span>`;
    }
  }

  function onDoseInputChanged() {
    updateDoseHelper();
    onInputChanged();
  }

  // --- Mistake Guard Fix Button Action ---
  function onFixUnitClicked() {
    // Switch to mcg and trigger recalculate
    setDoseUnit('mcg');
  }

  // --- Reset Calculator ---
  function resetCalculator() {
    if (peptideSelect) {
      peptideSelect.value = '';
    }
    vialMgInput.value = '';
    bacWaterInput.value = '';
    desiredDoseInput.value = '';
    frequencySelect.value = '';
    mixDateInput.value = '';
    doseHelper.textContent = '';
    setDoseUnit('mcg');

    presetButtons.forEach(btn => btn.classList.remove('active'));

    updateChecklist();
    showEmptyState();
  }

  // --- Main Input Changed Handler ---
  function onInputChanged(e) {
    if (e && e.target && e.target.id) {
      if (e.target.id === 'vial-mg') {
        syncPresetButtons('vial-mg', vialMgInput.value);
      } else if (e.target.id === 'bac-water') {
        syncPresetButtons('bac-water', bacWaterInput.value);
      }
    }

    updateChecklist();

    const vialMg = parseFloat(vialMgInput.value);
    const bacWater = parseFloat(bacWaterInput.value);
    const rawDose = parseFloat(desiredDoseInput.value);

    // Rule: Do not show result until ALL required inputs are filled
    const isComplete = !isNaN(vialMg) && vialMg > 0 &&
                       !isNaN(bacWater) && bacWater > 0 &&
                       !isNaN(rawDose) && rawDose > 0;

    if (!isComplete) {
      showEmptyState();
      return;
    }

    // All inputs present: calculate!
    calculateResults(vialMg, bacWater, rawDose);
  }

  function updateChecklist() {
    const vialMg = parseFloat(vialMgInput.value);
    const bacWater = parseFloat(bacWaterInput.value);
    const rawDose = parseFloat(desiredDoseInput.value);

    if (checkVial) {
      checkVial.classList.toggle('done', !isNaN(vialMg) && vialMg > 0);
    }
    if (checkWater) {
      checkWater.classList.toggle('done', !isNaN(bacWater) && bacWater > 0);
    }
    if (checkDose) {
      checkDose.classList.toggle('done', !isNaN(rawDose) && rawDose > 0);
    }
  }

  function showEmptyState() {
    emptyState.style.display = 'flex';
    resultsContainer.style.display = 'none';
  }

  // --- Core Calculation & Warnings ---
  function calculateResults(vialMg, bacWater, rawDose) {
    emptyState.style.display = 'none';
    resultsContainer.style.display = 'flex';

    // 1. Dose in mg and mcg
    let doseMg = currentDoseUnit === 'mcg' ? rawDose / 1000 : rawDose;
    let doseMcg = currentDoseUnit === 'mg' ? rawDose * 1000 : rawDose;

    // 2. Syringe specs
    const syringeOption = syringeSelect.options[syringeSelect.selectedIndex];
    const maxUnits = parseFloat(syringeOption.getAttribute('data-units')) || 100;
    const maxMl = parseFloat(syringeOption.getAttribute('data-ml')) || 1.0;
    const syringeCal = parseFloat(syringeOption.getAttribute('data-cal')) || 100; // units per mL (100 for U-100, 40 for U-40)

    syringeCalLabel.textContent = syringeOption.textContent.split('—')[0].trim();

    // 3. Concentrations
    const concMgPerMl = vialMg / bacWater;
    const concMcgPerMl = concMgPerMl * 1000;
    const mcgPerUnit = concMcgPerMl / syringeCal;

    // 4. Draw volume & units
    const drawMl = doseMg / concMgPerMl;
    const drawUnits = drawMl * syringeCal;

    // 5. Doses per vial
    const dosesPerVial = vialMg / doseMg;

    // --- Safety Warnings Evaluation ---

    // A. Over-Capacity Warning
    const isOverCapacity = drawUnits > maxUnits;
    if (isOverCapacity) {
      warnOvercapacity.style.display = 'flex';
      overcapacityUnits.textContent = formatNumber(drawUnits, 1);
      overcapacityMl.textContent = formatNumber(drawMl, 2);
      overcapacityMax.textContent = maxUnits;
    } else {
      warnOvercapacity.style.display = 'none';
    }

    // B. mg / mcg Mistake Guard
    // Triggers if user chose 'mg' and dose looks abnormally high (>100 units or dose >= vialMg or rawDose >= 5 mg)
    let isMistakeGuardTriggered = false;
    let mistakeType = 'mg'; // 'mg' or 'huge'

    if (currentDoseUnit === 'mg') {
      if (rawDose >= vialMg || drawUnits > 100 || (rawDose >= 5 && drawUnits > maxUnits)) {
        isMistakeGuardTriggered = true;
        mistakeType = 'mg';
      }
    } else if (drawUnits > 200) {
      // Even in mcg, if draw is over 200 units (>2 full syringes), alert user
      isMistakeGuardTriggered = true;
      mistakeType = 'huge';
    }

    if (isMistakeGuardTriggered) {
      warnMistakeGuard.style.display = 'flex';
      if (mistakeType === 'mg') {
        mistakeDoseVal.textContent = `${rawDose} mg`;
        mistakeMcgFix.textContent = rawDose;
        btnFixUnit.style.display = 'inline-block';
        btnFixUnit.textContent = `Switch dose to ${rawDose} mcg instead`;
        document.querySelector('.mistake-hint').textContent = 'Most peptide doses are prescribed in micrograms (mcg), not milligrams (mg). 1 mg = 1,000 mcg.';
      } else {
        mistakeDoseVal.textContent = `${rawDose} mcg (${formatNumber(drawUnits, 1)} units)`;
        btnFixUnit.style.display = 'none';
        document.querySelector('.mistake-hint').textContent = 'Peptide single doses rarely exceed 100 units. Please verify your prescribed protocol.';
      }
    } else {
      warnMistakeGuard.style.display = 'none';
    }

    // C. Low-Volume Warning (< 5 Units)
    if (!isOverCapacity && drawUnits < 5) {
      warnLowVolume.style.display = 'flex';
    } else {
      warnLowVolume.style.display = 'none';
    }

    // --- Populate Hero & Metric Outputs ---
    const formattedUnits = formatNumber(drawUnits, 1);
    outUnits.textContent = formattedUnits;
    outSubUnits.textContent = `${formattedUnits} units`;
    outVolumeMl.textContent = `${formatNumber(drawMl, 3)} mL`;

    // Fraction hint if not a whole number or .5
    const remainder = Math.round((drawUnits % 1) * 10) / 10;
    if (remainder !== 0 && remainder !== 0.5) {
      const lower = Math.floor(drawUnits);
      const upper = Math.ceil(drawUnits);
      fractionNote.style.display = 'inline-block';
      fractionNote.textContent = `Scale guide: ${formattedUnits} units is between ${lower} and ${upper} units`;
    } else {
      fractionNote.style.display = 'none';
    }

    // Metrics Grid
    outMetricMl.textContent = `${formatNumber(drawMl, 2)} mL`;
    outConcentrationMg.textContent = `${formatNumber(concMgPerMl, 2)} mg/mL`;
    outConcentrationMcg.textContent = `${formatNumber(concMcgPerMl, 0)} mcg/mL`;
    outMcgPerUnit.textContent = `${formatNumber(mcgPerUnit, 1)} mcg`;
    outDosesPerVial.textContent = `${formatNumber(dosesPerVial, 1)} doses`;

    // --- Optional Protocol Calculations ---
    let showProtocolBox = false;
    const frequencyVal = parseFloat(frequencySelect.value);
    const mixDateVal = mixDateInput.value;

    // Lifespan & 30-Day Warning
    if (!isNaN(frequencyVal) && frequencyVal > 0) {
      const daysOfSupply = Math.floor(dosesPerVial / frequencyVal);
      outLifespanDays.textContent = `~${daysOfSupply} Days`;
      statDurationWrap.style.display = 'flex';
      showProtocolBox = true;

      if (daysOfSupply > 30) {
        warnExpiry.style.display = 'flex';
      } else {
        warnExpiry.style.display = 'none';
      }
    } else {
      statDurationWrap.style.display = 'none';
      warnExpiry.style.display = 'none';
    }

    // Discard Date (28 Days)
    if (mixDateVal) {
      const mixDate = new Date(mixDateVal);
      if (!isNaN(mixDate.getTime())) {
        const discardDate = new Date(mixDate);
        discardDate.setDate(discardDate.getDate() + 28);
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        outDiscardDate.textContent = discardDate.toLocaleDateString(undefined, options);
        statDiscardWrap.style.display = 'flex';
        showProtocolBox = true;
      }
    } else {
      statDiscardWrap.style.display = 'none';
    }

    protocolStatsBox.style.display = showProtocolBox ? 'flex' : 'none';

    // --- Render Visual Syringe & Magnifier ---
    renderVisualSyringe(drawUnits, maxUnits, isOverCapacity);
    renderMagnifier(drawUnits, maxUnits, isOverCapacity);
  }

  // --- SVG Visual Syringe Renderer ---
  function renderVisualSyringe(units, maxUnits, isOverCapacity) {
    // Syringe geometry
    const svgWidth = 620;
    const svgHeight = 125;

    const barrelX = 70;
    const barrelY = 32;
    const barrelWidth = 430;
    const barrelHeight = 48;

    const zeroX = barrelX + 15;
    const maxUnitX = barrelX + barrelWidth - 20;
    const scaleWidth = maxUnitX - zeroX;
    const pxPerUnit = scaleWidth / maxUnits;

    // Clamped position for the stopper
    const clampedUnits = Math.max(0, Math.min(units, maxUnits));
    const stopperFrontX = zeroX + clampedUnits * pxPerUnit;
    const fluidWidth = Math.max(0, stopperFrontX - zeroX);

    // Fluid fill color (cyan/blue or red warning if overcapacity)
    const fluidGradStart = isOverCapacity ? '#fca5a5' : '#38bdf8';
    const fluidGradEnd = isOverCapacity ? '#ef4444' : '#0284c7';
    const meniscusColor = isOverCapacity ? '#b91c1c' : '#0369a1';

    // Build SVG parts
    let svg = `<svg viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Visual Syringe at ${units} units">
      <defs>
        <linearGradient id="fluidGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${fluidGradStart}" stop-opacity="0.8" />
          <stop offset="96%" stop-color="${fluidGradEnd}" stop-opacity="0.9" />
          <stop offset="100%" stop-color="${meniscusColor}" stop-opacity="1" />
        </linearGradient>
        <linearGradient id="barrelShine" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.75" />
          <stop offset="35%" stop-color="#ffffff" stop-opacity="0.1" />
          <stop offset="80%" stop-color="#000000" stop-opacity="0.05" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0.3" />
        </linearGradient>
        <linearGradient id="plungerRod" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#cbd5e1" />
          <stop offset="50%" stop-color="#f8fafc" />
          <stop offset="100%" stop-color="#94a3b8" />
        </linearGradient>
        <linearGradient id="stopperRubber" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#1e293b" />
          <stop offset="50%" stop-color="#334155" />
          <stop offset="100%" stop-color="#0f172a" />
        </linearGradient>
      </defs>`;

    // 1. Needle & Hub (Left)
    svg += `
      <!-- Needle Cannula -->
      <line x1="8" y1="${barrelY + barrelHeight / 2}" x2="45" y2="${barrelY + barrelHeight / 2}" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
      <polygon points="8,${barrelY + barrelHeight / 2 - 1} 13,${barrelY + barrelHeight / 2 - 2} 13,${barrelY + barrelHeight / 2} 8,${barrelY + barrelHeight / 2}" fill="#64748b"/>
      
      <!-- Needle Hub (Luer Slip / Integrated) -->
      <polygon points="45,${barrelY + barrelHeight / 2 - 7} 68,${barrelY + barrelHeight / 2 - 14} 70,${barrelY + barrelHeight / 2 + 14} 45,${barrelY + barrelHeight / 2 + 7}" fill="#f97316" stroke="#ea580c" stroke-width="1.2"/>
      <rect x="66" y="${barrelY + barrelHeight / 2 - 11}" width="4" height="22" rx="1" fill="#c2410c"/>
    `;

    // 2. Plunger Rod & Thumb Rest (Right, extending behind stopper)
    const rodStartX = stopperFrontX + 16;
    const rodEndX = barrelX + barrelWidth + 75;
    svg += `
      <!-- Plunger Rod -->
      <rect x="${rodStartX}" y="${barrelY + barrelHeight / 2 - 6}" width="${Math.max(0, rodEndX - rodStartX)}" height="12" fill="url(#plungerRod)" stroke="#64748b" stroke-width="0.8"/>
      <!-- Plunger Thumb Rest / Flange -->
      <rect x="${rodEndX}" y="${barrelY - 2}" width="10" height="${barrelHeight + 4}" rx="3" fill="#cbd5e1" stroke="#64748b" stroke-width="1.2"/>
    `;

    // 3. Fluid Inside Barrel
    if (fluidWidth > 0) {
      svg += `
        <rect x="${zeroX}" y="${barrelY + 2}" width="${fluidWidth}" height="${barrelHeight - 4}" fill="url(#fluidGrad)" />
      `;
    }

    // 4. Black Rubber Piston / Stopper (Inside Barrel)
    svg += `
      <!-- Rubber Stopper (Front Rib aligns with dose) -->
      <rect x="${stopperFrontX}" y="${barrelY + 2}" width="18" height="${barrelHeight - 4}" rx="2" fill="url(#stopperRubber)" stroke="#0f172a" stroke-width="1"/>
      <!-- Stopper Rib Grooves -->
      <line x1="${stopperFrontX + 8}" y1="${barrelY + 2}" x2="${stopperFrontX + 8}" y2="${barrelY + barrelHeight - 2}" stroke="#0f172a" stroke-width="2.5"/>
      <line x1="${stopperFrontX + 16}" y1="${barrelY + 2}" x2="${stopperFrontX + 16}" y2="${barrelY + barrelHeight - 2}" stroke="#020617" stroke-width="1.5"/>
    `;

    // 5. Glass Barrel Outline & Finger Flange
    svg += `
      <!-- Barrel Cylinder Glass -->
      <rect x="${barrelX}" y="${barrelY}" width="${barrelWidth}" height="${barrelHeight}" rx="4" fill="none" stroke="#64748b" stroke-width="2"/>
      <rect x="${barrelX}" y="${barrelY}" width="${barrelWidth}" height="${barrelHeight}" rx="4" fill="url(#barrelShine)" pointer-events="none"/>
      <!-- Finger Grip Flange -->
      <rect x="${barrelX + barrelWidth - 2}" y="${barrelY - 14}" width="8" height="${barrelHeight + 28}" rx="3" fill="#e2e8f0" stroke="#64748b" stroke-width="1.5"/>
    `;

    // 6. Syringe Calibration Tick Marks & Numbers
    svg += generateSyringeTicks(maxUnits, zeroX, pxPerUnit, barrelY, barrelHeight);

    // 7. Dose Indicator Pointer & Callout Badge
    const calloutX = Math.min(Math.max(stopperFrontX, 50), 550);
    const calloutY = barrelY - 6;
    const badgeText = isOverCapacity ? `⚠️ Over: ${formatNumber(units, 1)} Units` : `${formatNumber(units, 1)} Units`;
    const badgeColor = isOverCapacity ? '#dc2626' : '#0284c7';

    svg += `
      <!-- Target Marker Line & Pointer -->
      <line x1="${stopperFrontX}" y1="${barrelY - 2}" x2="${stopperFrontX}" y2="${barrelY + barrelHeight + 2}" stroke="${badgeColor}" stroke-width="2.5" stroke-dasharray="3,2"/>
      <!-- Pointer Triangle -->
      <polygon points="${stopperFrontX},${calloutY} ${stopperFrontX - 5},${calloutY - 8} ${stopperFrontX + 5},${calloutY - 8}" fill="${badgeColor}"/>
      <!-- Badge Pill -->
      <rect x="${calloutX - 44}" y="${calloutY - 24}" width="88" height="18" rx="9" fill="${badgeColor}" />
      <text x="${calloutX}" y="${calloutY - 12}" fill="#ffffff" font-family="-apple-system, sans-serif" font-size="9" font-weight="800" text-anchor="middle" dominant-baseline="middle">${badgeText}</text>
    `;

    svg += `</svg>`;
    syringeSvgContainer.innerHTML = svg;
  }

  // --- Syringe Tick Generator ---
  function generateSyringeTicks(maxUnits, zeroX, pxPerUnit, barrelY, barrelHeight) {
    let tickSvg = `<g class="syringe-ticks">`;

    // Determine intervals based on maxUnits
    let majorInterval = 10;
    let mediumInterval = 5;
    let minorInterval = 2;

    if (maxUnits === 30 || maxUnits === 40 || maxUnits === 50) {
      majorInterval = 5;
      mediumInterval = null;
      minorInterval = 1;
    }

    for (let u = 0; u <= maxUnits; u += (minorInterval || 1)) {
      const x = zeroX + u * pxPerUnit;
      const isMajor = u % majorInterval === 0;
      const isMedium = mediumInterval && (u % mediumInterval === 0) && !isMajor;

      let tickLen = 6;
      let strokeWidth = 0.8;
      let strokeColor = '#64748b';

      if (isMajor) {
        tickLen = 14;
        strokeWidth = 1.4;
        strokeColor = '#0f172a';
      } else if (isMedium) {
        tickLen = 10;
        strokeWidth = 1.0;
        strokeColor = '#334155';
      }

      // Draw tick from top edge down
      tickSvg += `<line x1="${x}" y1="${barrelY + 2}" x2="${x}" y2="${barrelY + 2 + tickLen}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`;

      // Label major ticks
      if (isMajor && u > 0 && u <= maxUnits) {
        tickSvg += `<text x="${x}" y="${barrelY + 2 + tickLen + 9}" fill="#1e293b" font-family="-apple-system, sans-serif" font-size="8.5" font-weight="700" text-anchor="middle">${u}</text>`;
      }
    }

    tickSvg += `</g>`;
    return tickSvg;
  }

  // --- Magnifier / Zoom View (PRD Requirement) ---
  function renderMagnifier(units, maxUnits, isOverCapacity) {
    const width = 480;
    const height = 115;

    if (isOverCapacity) {
      // Overcapacity specialized magnifier warning view
      const svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Magnifier Overcapacity Alert">
        <rect x="20" y="16" width="${width - 40}" height="76" rx="8" fill="#fef2f2" stroke="#dc2626" stroke-width="2"/>
        <circle cx="55" cy="54" r="16" fill="#fee2e2" stroke="#dc2626" stroke-width="1.5"/>
        <text x="55" y="60" fill="#dc2626" font-family="-apple-system, sans-serif" font-size="16" font-weight="900" text-anchor="middle">!</text>
        <text x="85" y="46" fill="#991b1b" font-family="-apple-system, sans-serif" font-size="13" font-weight="800">Capacity Exceeded in Selected Syringe</text>
        <text x="85" y="66" fill="#7f1d1d" font-family="-apple-system, sans-serif" font-size="11" font-weight="600">Requires ${formatNumber(units, 1)} Units • Max Syringe Barrel is ${maxUnits} Units</text>
        <text x="85" y="82" fill="#b91c1c" font-family="-apple-system, sans-serif" font-size="10" font-weight="500">Switch to a 0.5 mL or 1.0 mL syringe above to view alignment marks.</text>
      </svg>`;
      magnifierContainer.innerHTML = svg;
      return;
    }

    // We zoom into a window around the target units: span of ~8 units
    const spanUnits = 8;
    const clampedUnits = Math.max(0, Math.min(units, maxUnits));
    const startUnit = Math.max(0, clampedUnits - spanUnits / 2);
    const endUnit = Math.min(maxUnits, startUnit + spanUnits);
    const actualSpan = Math.max(2, endUnit - startUnit);
    const pxPerUnitMag = (width - 120) / actualSpan;
    const startX = 60;

    // Stopper leading edge in magnified coordinates
    const targetX = startX + (clampedUnits - startUnit) * pxPerUnitMag;

    let svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Magnified Syringe Stopper View">
      <defs>
        <linearGradient id="magFluid" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.85" />
          <stop offset="100%" stop-color="#0284c7" stop-opacity="0.95" />
        </linearGradient>
      </defs>

      <!-- Magnifier Glass Barrel Background -->
      <rect x="20" y="16" width="${width - 40}" height="76" rx="8" fill="#ffffff" stroke="#0284c7" stroke-width="2"/>
      
      <!-- Fluid in Magnifier -->
      <rect x="22" y="18" width="${Math.max(0, targetX - 22)}" height="72" fill="url(#magFluid)" />

      <!-- Rubber Stopper in Magnifier -->
      <rect x="${targetX}" y="18" width="80" height="72" rx="4" fill="#0f172a" stroke="#020617" stroke-width="1.5"/>
      <rect x="${targetX + 25}" y="18" width="10" height="72" fill="#1e293b"/>
      <rect x="${targetX + 50}" y="18" width="10" height="72" fill="#1e293b"/>
    `;

    // High precision tick marks in magnified window
    svg += `<g class="mag-ticks">`;
    for (let u = Math.floor(startUnit); u <= Math.ceil(endUnit); u += 0.5) {
      if (u < 0 || u > maxUnits) continue;
      const x = startX + (u - startUnit) * pxPerUnitMag;
      const isWhole = Number.isInteger(u);
      const isFive = isWhole && (u % 5 === 0);

      const tickHeight = isFive ? 24 : isWhole ? 16 : 9;
      const strokeWidth = isFive ? 2 : isWhole ? 1.5 : 1;
      const color = isFive ? '#0f172a' : isWhole ? '#334155' : '#64748b';

      svg += `<line x1="${x}" y1="18" x2="${x}" y2="${18 + tickHeight}" stroke="${color}" stroke-width="${strokeWidth}"/>`;

      if (isWhole) {
        svg += `<text x="${x}" y="${18 + tickHeight + 14}" fill="#0f172a" font-family="-apple-system, sans-serif" font-size="11" font-weight="800" text-anchor="middle">${u}</text>`;
      }
    }
    svg += `</g>`;

    // Alignment Target Line & Stopper Guidance
    svg += `
      <!-- Red Alignment Guide Line -->
      <line x1="${targetX}" y1="12" x2="${targetX}" y2="98" stroke="#dc2626" stroke-width="2.5" stroke-dasharray="4,2"/>
      <polygon points="${targetX},96 ${targetX - 5},105 ${targetX + 5},105" fill="#dc2626"/>
      
      <!-- Instructional Target Callout -->
      <text x="${Math.min(Math.max(targetX, 90), width - 90)}" y="112" fill="#dc2626" font-family="-apple-system, sans-serif" font-size="10" font-weight="800" text-anchor="middle">
        ▲ ALIGN FRONT EDGE: ${formatNumber(units, 1)} UNITS
      </text>
    `;

    svg += `</svg>`;
    magnifierContainer.innerHTML = svg;
  }

  // --- Utility Number Formatter ---
  function formatNumber(num, maxDecimals = 2) {
    if (isNaN(num)) return '0';
    // Remove trailing zeros smoothly
    const rounded = Number(Math.round(num + 'e' + maxDecimals) + 'e-' + maxDecimals);
    return rounded.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: maxDecimals
    });
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
