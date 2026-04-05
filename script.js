const CURRENCY_FORMATTER = new Intl.NumberFormat("en-GH", {
  style: "currency",
  currency: "GHS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PAYE_BANDS = [
  { label: "First GH¢490", width: 490, rate: 0 },
  { label: "Next GH¢110", width: 110, rate: 0.05 },
  { label: "Next GH¢130", width: 130, rate: 0.1 },
  { label: "Next GH¢3,166.67", width: 3166.67, rate: 0.175 },
  { label: "Next GH¢16,000", width: 16000, rate: 0.25 },
  { label: "Next GH¢30,520", width: 30520, rate: 0.3 },
  { label: "Remaining balance", width: Infinity, rate: 0.35 },
];

const STANDARD_VAT_COMPONENTS = {
  vat: 0.15,
  nhil: 0.025,
  getFund: 0.025,
};

const TOTAL_STANDARD_VAT_RATE =
  STANDARD_VAT_COMPONENTS.vat +
  STANDARD_VAT_COMPONENTS.nhil +
  STANDARD_VAT_COMPONENTS.getFund;

const payeForm = document.getElementById("paye-form");
const vatForm = document.getElementById("vat-form");
const compoundForm = document.getElementById("compound-form");
const tbillForm = document.getElementById("tbill-form");

function toMoney(value) {
  return CURRENCY_FORMATTER.format(Number.isFinite(value) ? value : 0);
}

function toPercent(value, digits = 2) {
  const numericValue = Number.isFinite(value) ? value : 0;
  return `${numericValue.toFixed(digits)}%`;
}

function readNumber(inputId) {
  const input = document.getElementById(inputId);
  const value = Number.parseFloat(input.value);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function clampPositive(value) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function calculateResidentPaye(chargeableIncome) {
  let remaining = chargeableIncome;
  let totalTax = 0;

  const breakdown = PAYE_BANDS.map((band) => {
    const taxableAtBand = Math.min(remaining, band.width);
    const tax = taxableAtBand * band.rate;

    if (remaining > 0) {
      remaining -= taxableAtBand;
    }

    totalTax += tax;

    return {
      band: band.label,
      taxableAtBand,
      rate: `${(band.rate * 100).toFixed(band.rate === 0.175 ? 1 : 0)}%`,
      tax,
    };
  });

  return {
    totalTax,
    breakdown,
  };
}

function calculatePaye() {
  const taxpayerType = payeForm.elements.taxpayerType.value;
  const basicSalary = readNumber("basicSalary");
  const allowances = readNumber("allowances");
  const relief = readNumber("relief");
  const includeSsnit = document.getElementById("includeSsnit").checked;

  const grossIncome = basicSalary + allowances;
  const ssnit = includeSsnit ? basicSalary * 0.055 : 0;
  const chargeableIncome = Math.max(grossIncome - ssnit - relief, 0);

  let payeTax = 0;
  let breakdown = [];

  if (taxpayerType === "resident") {
    const result = calculateResidentPaye(chargeableIncome);
    payeTax = result.totalTax;
    breakdown = result.breakdown;
  } else {
    payeTax = chargeableIncome * 0.25;
    breakdown = [
      {
        band: "Non-resident flat rate",
        taxableAtBand: chargeableIncome,
        rate: "25%",
        tax: payeTax,
      },
    ];
  }

  const netIncome = grossIncome - ssnit - payeTax;

  document.getElementById("grossIncome").textContent = toMoney(grossIncome);
  document.getElementById("ssnitValue").textContent = toMoney(ssnit);
  document.getElementById("chargeableIncome").textContent = toMoney(chargeableIncome);
  document.getElementById("payeTax").textContent = toMoney(payeTax);
  document.getElementById("netIncome").textContent = toMoney(netIncome);

  renderPayeBreakdown(breakdown, taxpayerType);
}

function renderPayeBreakdown(breakdown, taxpayerType) {
  const container = document.getElementById("payeBreakdown");

  const header = `
    <div class="breakdown-row header">
      <div>Band</div>
      <div>Taxable</div>
      <div>Rate</div>
      <div>Tax</div>
    </div>
  `;

  const rows = breakdown
    .map(
      (item) => `
        <div class="breakdown-row">
          <div>${item.band}</div>
          <div>${toMoney(item.taxableAtBand)}</div>
          <div>${item.rate}</div>
          <div>${toMoney(item.tax)}</div>
        </div>
      `
    )
    .join("");

  const note =
    taxpayerType === "resident"
      ? `<p class="helper-copy">Resident PAYE uses the monthly graduated band widths currently shown by GRA.</p>`
      : `<p class="helper-copy">Non-resident PAYE is shown by GRA as a flat 25% of chargeable income.</p>`;

  container.innerHTML = `${header}${rows}${note}`;
}

function calculateVat() {
  const treatment = document.getElementById("vatTreatment").value;
  const amountType = vatForm.elements.vatAmountType.value;
  const amount = readNumber("vatAmount");

  let taxableValue = amount;
  let vat = 0;
  let nhil = 0;
  let getFund = 0;
  let inclusiveTotal = amount;
  let note = "";

  if (treatment === "standard") {
    if (amountType === "exclusive") {
      taxableValue = amount;
      vat = taxableValue * STANDARD_VAT_COMPONENTS.vat;
      nhil = taxableValue * STANDARD_VAT_COMPONENTS.nhil;
      getFund = taxableValue * STANDARD_VAT_COMPONENTS.getFund;
      inclusiveTotal = taxableValue + vat + nhil + getFund;
    } else {
      inclusiveTotal = amount;
      taxableValue = amount / (1 + TOTAL_STANDARD_VAT_RATE);
      vat = taxableValue * STANDARD_VAT_COMPONENTS.vat;
      nhil = taxableValue * STANDARD_VAT_COMPONENTS.nhil;
      getFund = taxableValue * STANDARD_VAT_COMPONENTS.getFund;
    }

    note =
      amountType === "exclusive"
        ? "This Ghana VAT calculator applies VAT, NHIL, and GETFund on the same taxable value."
        : "For tax-inclusive figures, the calculator backs out the taxable value by dividing by 1.20 before splitting the tax components.";
  } else if (treatment === "zeroRated") {
    taxableValue = amount;
    inclusiveTotal = amount;
    note =
      "Zero-rated supplies carry a 0% rate for VAT, NHIL, and GETFund.";
  } else {
    taxableValue = amount;
    inclusiveTotal = amount;
    note =
      "Exempt or relieved supplies do not attract VAT, NHIL, or GETFund. Confirm the classification for the exact good or service.";
  }

  document.getElementById("vatTaxableValue").textContent = toMoney(taxableValue);
  document.getElementById("vatTotalTax").textContent = toMoney(vat + nhil + getFund);
  document.getElementById("vatValue").textContent = toMoney(vat);
  document.getElementById("nhilValue").textContent = toMoney(nhil);
  document.getElementById("getFundValue").textContent = toMoney(getFund);
  document.getElementById("vatInclusiveTotal").textContent = toMoney(inclusiveTotal);
  document.getElementById("vatNote").textContent = note;
}

function calculateCompoundInterest() {
  const principal = readNumber("compoundPrincipal");
  const contribution = readNumber("compoundContribution");
  const annualRate = readNumber("compoundRate") / 100;
  const frequency = clampPositive(Number.parseInt(compoundForm.elements.compoundFrequency.value, 10));
  const years = readNumber("compoundYears");
  const months = Math.round(years * 12);

  const monthlyRate =
    frequency > 0
      ? Math.pow(1 + annualRate / frequency, frequency / 12) - 1
      : 0;

  let balance = principal;

  for (let month = 0; month < months; month += 1) {
    balance *= 1 + monthlyRate;
    balance += contribution;
  }

  const totalDeposits = principal + contribution * months;
  const interestEarned = balance - totalDeposits;
  const effectiveAnnualRate = Math.pow(1 + monthlyRate, 12) - 1;
  const estimatedMonthlyGain = balance * monthlyRate;

  document.getElementById("compoundFutureValue").textContent = toMoney(balance);
  document.getElementById("compoundDeposits").textContent = toMoney(totalDeposits);
  document.getElementById("compoundInterestEarned").textContent = toMoney(interestEarned);
  document.getElementById("compoundMonthlyGain").textContent = toMoney(estimatedMonthlyGain);
  document.getElementById("compoundEffectiveRate").textContent = toPercent(
    effectiveAnnualRate * 100
  );
  document.getElementById("compoundNote").textContent =
    "Monthly contributions are added at the end of each month. The monthly growth effect is derived from the compounding frequency you selected.";
}

function calculateTreasuryBill() {
  const tenorDays = clampPositive(Number.parseInt(tbillForm.elements.tbillTenor.value, 10));
  const quotedRate = readNumber("tbillRate") / 100;
  const rateType = tbillForm.elements.tbillRateType.value;
  const amountType = tbillForm.elements.tbillAmountType.value;
  const amount = readNumber("tbillAmount");

  let purchasePrice = 0;
  let maturityValue = 0;
  let interestEarned = 0;
  let discountRate = 0;
  let interestRate = 0;
  let note = "";

  if (rateType === "discount") {
    discountRate = quotedRate;
    const factor = 1 - discountRate * (tenorDays / 364);

    if (factor > 0) {
      if (amountType === "investment") {
        purchasePrice = amount;
        maturityValue = purchasePrice / factor;
      } else {
        maturityValue = amount;
        purchasePrice = maturityValue * factor;
      }
    }

    interestEarned = maturityValue - purchasePrice;
    interestRate =
      purchasePrice > 0 ? (interestEarned / purchasePrice) * (364 / tenorDays) : 0;

    note =
      "This result uses the Bank of Ghana discount-bill convention with a 364-day basis. The quoted discount rate is converted to its equivalent interest rate.";
  } else {
    interestRate = quotedRate;
    const factor = 1 + interestRate * (tenorDays / 364);

    if (factor > 0) {
      if (amountType === "investment") {
        purchasePrice = amount;
        maturityValue = purchasePrice * factor;
      } else {
        maturityValue = amount;
        purchasePrice = maturityValue / factor;
      }
    }

    interestEarned = maturityValue - purchasePrice;
    discountRate =
      maturityValue > 0 ? (interestEarned / maturityValue) * (364 / tenorDays) : 0;

    note =
      "This result starts from the quoted interest rate and works back to the discount equivalent commonly shown in Bank of Ghana bill tables.";
  }

  document.getElementById("tbillMaturityValue").textContent = toMoney(maturityValue);
  document.getElementById("tbillPurchasePrice").textContent = toMoney(purchasePrice);
  document.getElementById("tbillInterestEarned").textContent = toMoney(interestEarned);
  document.getElementById("tbillDiscountRate").textContent = toPercent(discountRate * 100, 4);
  document.getElementById("tbillInterestRate").textContent = toPercent(interestRate * 100, 4);
  document.getElementById("tbillNote").textContent =
    `${note} This treasury bill calculator shows gross pricing only and does not apply investor-specific taxes or fees.`;
}

function attachEvents(form, callback) {
  form.addEventListener("input", callback);
  form.addEventListener("change", callback);
}

attachEvents(payeForm, calculatePaye);
attachEvents(vatForm, calculateVat);
attachEvents(compoundForm, calculateCompoundInterest);
attachEvents(tbillForm, calculateTreasuryBill);

calculatePaye();
calculateVat();
calculateCompoundInterest();
calculateTreasuryBill();
