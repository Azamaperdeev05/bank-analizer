/**
 * Unified Bank Statement Analyzer - Core Engine
 * Copyright (c) 2026 Azamat Perdeev. All Rights Reserved.
 * Licensed under the GNU General Public License v3 (GPL v3)
 * Repository: https://github.com/Azamaperdeev05/bank-analizer
 */

/* global pdfjsLib */

const state = {
  activeBank: null, // 'kaspi', 'halyk', 'forte', 'jusan', 'bcc'
  sourceName: null,
  account: null,
  accounts: [],
  transactions: [],
  filtered: []
}

const STORAGE_KEY = 'unified-bank-statement-analyzer-settings-v1'
const MS_PER_DAY = 24 * 60 * 60 * 1000

const typeLabels = {
  purchase: 'Сатып алу',
  transfer: 'Аударым',
  income: 'Кіріс',
  cash: 'Қолма-қол',
  other: 'Басқа'
}

const weekdayLabels = ['Жс', 'Дс', 'Сс', 'Ср', 'Бс', 'Жм', 'Сб']

const categoryOptions = [
  'Кіріс', 'Қайтарым', 'Аударым', 'Сатып алу', 'Азық-түлік', 'Тамақ', 'Көлік',
  'Дәріхана', 'Денсаулық', 'Байланыс', 'Үй', 'Киім', 'Білім', 'Сервис',
  'Демалыс', 'Қарыз', 'Жинақ', 'Комиссия', 'Қолма-қол', 'Басқа'
]

// Unified Bank Profiles Registry
const BANKS = {
  kaspi: {
    name: 'Kaspi Bank',
    code: 'kaspi',
    logoMark: 'K',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/kk/thumb/a/aa/Logo_of_Kaspi_bank.png/1280px-Logo_of_Kaspi_bank.png',
    watermark: 'KASPI',
    themeClass: 'theme-kaspi',
    typeColors: { purchase: '#f14635', transfer: '#d82f1f', income: '#2A7E5C', cash: '#696969', other: '#696969' },
    detect: text => /(ВЫПИСКА|ҮЗІНДІ КӨШІРМЕ|statement balance|Kaspi Gold)/i.test(text) && /Kaspi Bank|kaspi\.kz/i.test(text),
    parser: (text, fileName) => parseKaspi(text, fileName)
  },
  halyk: {
    name: 'Halyk Bank',
    code: 'halyk',
    logoMark: 'H',
    logoUrl: 'https://companieslogo.com/img/orig/H4L1.F-f93d8450.png?t=1746946303',
    watermark: 'HALYK',
    themeClass: 'theme-halyk',
    typeColors: { purchase: '#007a5c', transfer: '#f9b101', income: '#2A7E5C', cash: '#696969', other: '#696969' },
    detect: text => /(Народный Банк|Халық Банк|Halyk Bank|HalykCard|Halyk Gold)/i.test(text) || /halykbank\.kz|halyk\.kz/i.test(text),
    parser: (text, fileName) => parseHalyk(text, fileName)
  },
  forte: {
    name: 'ForteBank',
    code: 'forte',
    logoMark: 'F',
    logoUrl: 'https://main.storage-object.pscloud.io/Group_2087330520_1_ba6eecfc23.svg',
    watermark: 'FORTE',
    themeClass: 'theme-forte',
    typeColors: { purchase: '#a31551', transfer: '#830a3d', income: '#2A7E5C', cash: '#696969', other: '#696969' },
    detect: text => /(Forte|ForteBank|Форте Банк|АО «ForteBank»)/i.test(text) || /forte\.kz|fortebank/i.test(text),
    parser: (text, fileName) => parseForte(text, fileName)
  },
  jusan: {
    name: 'Alatau City Bank',
    code: 'jusan',
    logoMark: 'J',
    logoUrl: 'https://play-lh.googleusercontent.com/HdMEN9YZsSrYUGtzjz3XPEOzAj6tERw0sDhpiAa3gpliOLbIwMK9uwJtPxxrtPo8Cw',
    watermark: 'ALATAU',
    themeClass: 'theme-jusan',
    typeColors: { purchase: '#edb210', transfer: '#ca9605', income: '#2A7E5C', cash: '#696969', other: '#696969' },
    detect: text => /(Jusan|Жусан|Цеснабанк|Jýsan|Jusan Bank|Alatau City)/i.test(text) || /jusan\.kz|jysan/i.test(text),
    parser: (text, fileName) => parseJusan(text, fileName)
  },
  bcc: {
    name: 'Bank CenterCredit',
    code: 'bcc',
    logoMark: 'B',
    logoUrl: 'https://cdn.worldvectorlogo.com/logos/bcc-bank.svg',
    watermark: 'BCC',
    themeClass: 'theme-bcc',
    typeColors: { purchase: '#00b05a', transfer: '#eaad67', income: '#2A7E5C', cash: '#696969', other: '#696969' },
    detect: text => /(CenterCredit|ЦентрКредит|БЦК|BCC Bank|Банк ЦентрКредит)/i.test(text) || /bcc\.kz/i.test(text),
    parser: (text, fileName) => parseBcc(text, fileName)
  }
}

const settings = loadSettings()

const els = {
  // Screens & Navigation
  splashScreen: document.getElementById('splashScreen'),
  appHeader: document.getElementById('appHeader'),
  appShell: document.getElementById('appShell'),
  backToHubButton: document.getElementById('backToHubButton'),
  appHeaderBrandMark: document.getElementById('appHeaderBrandMark'),
  appHeaderBrandMarkImg: document.getElementById('appHeaderBrandMarkImg'),
  appHeaderBrandMarkText: document.getElementById('appHeaderBrandMarkText'),
  appHeaderTitle: document.getElementById('appHeaderTitle'),
  headerBankSwitcher: document.getElementById('headerBankSwitcher'),
  dropZoneBankName: document.getElementById('dropZoneBankName'),
  ghostWatermark: document.getElementById('ghostWatermark'),

  // Workspace logic elements
  fileInput: document.getElementById('fileInput'),
  splashFileInput: document.getElementById('splashFileInput'),
  dropZone: document.getElementById('dropZone'),
  clearButton: document.getElementById('clearButton'),
  exportButton: document.getElementById('exportButton'),
  exportJsonButton: document.getElementById('exportJsonButton'),
  reportButton: document.getElementById('reportButton'),
  searchInput: document.getElementById('searchInput'),
  typeFilter: document.getElementById('typeFilter'),
  periodFilter: document.getElementById('periodFilter'),
  timeGroup: document.getElementById('timeGroup'),
  dayFilter: document.getElementById('dayFilter'),
  clearDayButton: document.getElementById('clearDayButton'),
  privacyToggle: document.getElementById('privacyToggle'),
  excludeInternalToggle: document.getElementById('excludeInternalToggle'),
  largeAmountInput: document.getElementById('largeAmountInput'),
  incomePlanInput: document.getElementById('incomePlanInput'),
  budgetCategory: document.getElementById('budgetCategory'),
  budgetAmount: document.getElementById('budgetAmount'),
  saveBudgetButton: document.getElementById('saveBudgetButton'),
  goalName: document.getElementById('goalName'),
  goalTarget: document.getElementById('goalTarget'),
  goalSaved: document.getElementById('goalSaved'),
  addGoalButton: document.getElementById('addGoalButton'),
  activeFilterNote: document.getElementById('activeFilterNote'),
  statusLine: document.getElementById('statusLine'),
  fileName: document.getElementById('fileName'),
  accountId: document.getElementById('accountId'),
  cardTitle: document.getElementById('cardTitle'),
  periodText: document.getElementById('periodText'),
  transactionCountSide: document.getElementById('transactionCountSide'),
  balanceChange: document.getElementById('balanceChange'),
  balanceRange: document.getElementById('balanceRange'),
  incomeTotal: document.getElementById('incomeTotal'),
  incomeCount: document.getElementById('incomeCount'),
  expenseTotal: document.getElementById('expenseTotal'),
  expenseCount: document.getElementById('expenseCount'),
  transferTotal: document.getElementById('transferTotal'),
  transferCount: document.getElementById('transferCount'),
  purchaseTotal: document.getElementById('purchaseTotal'),
  purchaseCount: document.getElementById('purchaseCount'),
  realExpenseTotal: document.getElementById('realExpenseTotal'),
  realExpenseMeta: document.getElementById('realExpenseMeta'),
  dailyAverageExpense: document.getElementById('dailyAverageExpense'),
  dailyAverageMeta: document.getElementById('dailyAverageMeta'),
  safeDailyLimit: document.getElementById('safeDailyLimit'),
  safeDailyMeta: document.getElementById('safeDailyMeta'),
  operationBars: document.getElementById('operationBars'),
  dailyChart: document.getElementById('dailyChart'),
  topList: document.getElementById('topList'),
  incomePeopleList: document.getElementById('incomePeopleList'),
  peopleList: document.getElementById('peopleList'),
  periodList: document.getElementById('periodList'),
  timeBreakdownLabel: document.getElementById('timeBreakdownLabel'),
  calendarHeatmap: document.getElementById('calendarHeatmap'),
  dayDetailLabel: document.getElementById('dayDetailLabel'),
  dayDetail: document.getElementById('dayDetail'),
  budgetMonthLabel: document.getElementById('budgetMonthLabel'),
  budgetList: document.getElementById('budgetList'),
  goalList: document.getElementById('goalList'),
  financeRule: document.getElementById('financeRule'),
  largeTransactionLabel: document.getElementById('largeTransactionLabel'),
  largeTransactionList: document.getElementById('largeTransactionList'),
  recurringList: document.getElementById('recurringList'),
  unusualDaysList: document.getElementById('unusualDaysList'),
  weekdayList: document.getElementById('weekdayList'),
  transactionTable: document.getElementById('transactionTable')
}

if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
}

initializeSettingsControls()
wireHubInteractions()

// Developer Easter Egg
console.log(
  `%c"Talk is cheap. Show me the code."%c — Linus Torvalds\n%c"Talk is cheap, send patches."%c — Open-source / FFmpeg вариациясы\n\n%cБұл жоба толықтай ашық кодты (GNU GPL v3). Pull Request немесе патч жіберуге қош келдіңіз! 🚀\n%cGitHub: https://github.com/Azamaperdeev05/bank-analizer`,
  "color: #6366F1; font-style: italic; font-size: 14px; font-family: monospace;",
  "color: #888; font-size: 12px;",
  "color: #6366F1; font-weight: bold; font-size: 15px; font-family: monospace; text-shadow: 0 0 8px rgba(99, 102, 241, 0.4);",
  "color: #888; font-size: 12px;",
  "color: #475569; font-size: 13px; font-weight: 500;",
  "color: #007a5c; font-size: 12px; text-decoration: underline;"
);

// Hub Screen & Swappers Wiring
function wireHubInteractions() {
  // Back to Selection Splash
  els.backToHubButton.addEventListener('click', () => {
    state.activeBank = null
    state.sourceName = null
    state.account = null
    state.accounts = []
    state.transactions = []
    
    // Clear styles
    document.body.className = 'theme-default'
    els.fileInput.value = ''
    els.splashFileInput.value = ''
    
    // Reset header logo
    els.appHeaderBrandMarkImg.src = ''
    els.appHeaderBrandMarkImg.style.display = 'none'
    els.appHeaderBrandMarkText.style.display = 'block'
    
    // Toggle overlays
    els.splashScreen.classList.remove('hidden')
    els.appHeader.classList.add('hidden')
    els.appShell.classList.add('hidden')
  })

  // Splash selection click handlers
  document.getElementById('bankSplashGrid').addEventListener('click', event => {
    const card = event.target.closest('.splash-card')
    if (!card) return
    const bankCode = card.dataset.bank
    selectBank(bankCode)
  })

  // Header quick swapper dropdown
  els.headerBankSwitcher.addEventListener('change', () => {
    const bankCode = els.headerBankSwitcher.value
    selectBank(bankCode, false) // Switch without resetting view
  })

  // Splash dropzone
  const splashDrop = document.getElementById('splashDropZone')
  splashDrop.addEventListener('dragover', e => {
    e.preventDefault()
    splashDrop.classList.add('is-dragging')
  })
  splashDrop.addEventListener('dragleave', () => {
    splashDrop.classList.remove('is-dragging')
  })
  splashDrop.addEventListener('drop', e => {
    e.preventDefault()
    splashDrop.classList.remove('is-dragging')
    handleFiles(Array.from(e.dataTransfer.files || []))
  })
  els.splashFileInput.addEventListener('change', e => {
    handleFiles(Array.from(e.target.files || []))
  })
}

function selectBank(bankCode, animate = true) {
  state.activeBank = bankCode
  const profile = BANKS[bankCode]
  if (!profile) return

  // Apply theme class to body
  document.body.className = profile.themeClass
  
  // Update header and labels
  if (profile.logoUrl) {
    els.appHeaderBrandMarkImg.src = profile.logoUrl
    els.appHeaderBrandMarkImg.style.display = 'block'
    els.appHeaderBrandMarkText.style.display = 'none'
  } else {
    els.appHeaderBrandMarkText.textContent = profile.logoMark
    els.appHeaderBrandMarkImg.style.display = 'none'
    els.appHeaderBrandMarkText.style.display = 'block'
  }
  
  els.appHeaderTitle.textContent = `${profile.name} PDF талдау`
  els.dropZoneBankName.textContent = `${profile.name} үзінді көшірмесі`
  els.headerBankSwitcher.value = bankCode
  els.ghostWatermark.textContent = profile.watermark
  
  // Transition screens
  els.splashScreen.classList.add('hidden')
  els.appHeader.classList.remove('hidden')
  els.appShell.classList.remove('hidden')
  
  if (animate) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  
  render()
}

// Beautiful Collapsible Panel Toggles on All Devices
document.addEventListener('click', event => {
  const header = event.target.closest('.panel-toggle-header')
  if (!header) return
  const panel = header.closest('.collapsible-panel')
  if (panel) {
    panel.classList.toggle('collapsed')
  }
})

els.fileInput.addEventListener('change', () => {
  handleFiles(Array.from(els.fileInput.files || []))
})

els.dropZone.addEventListener('dragover', event => {
  event.preventDefault()
  els.dropZone.classList.add('is-dragging')
})

els.dropZone.addEventListener('dragleave', () => {
  els.dropZone.classList.remove('is-dragging')
})

els.dropZone.addEventListener('drop', event => {
  event.preventDefault()
  els.dropZone.classList.remove('is-dragging')
  handleFiles(Array.from(event.dataTransfer.files || []))
})

els.searchInput.addEventListener('input', render)
els.typeFilter.addEventListener('change', render)
els.periodFilter.addEventListener('change', render)
els.timeGroup.addEventListener('change', render)
els.dayFilter.addEventListener('change', render)
els.privacyToggle.addEventListener('change', () => {
  settings.privacyMode = els.privacyToggle.checked
  saveSettings()
  render()
})
els.excludeInternalToggle.addEventListener('change', () => {
  settings.excludeInternal = els.excludeInternalToggle.checked
  saveSettings()
  render()
})
els.largeAmountInput.addEventListener('change', () => {
  settings.largeAmount = Math.max(0, Number(els.largeAmountInput.value) || 0)
  saveSettings()
  render()
})
els.incomePlanInput.addEventListener('change', () => {
  settings.monthlyIncomePlan = Math.max(0, Number(els.incomePlanInput.value) || 0)
  saveSettings()
  render()
})
els.budgetCategory.addEventListener('change', () => {
  els.budgetAmount.value = settings.budgets[els.budgetCategory.value] || ''
})
els.saveBudgetButton.addEventListener('click', () => {
  const category = els.budgetCategory.value
  const amount = Math.max(0, Number(els.budgetAmount.value) || 0)
  if (amount > 0) {
    settings.budgets[category] = amount
  } else {
    delete settings.budgets[category]
  }
  saveSettings()
  render()
})
els.addGoalButton.addEventListener('click', () => {
  addGoal()
})
els.clearDayButton.addEventListener('click', () => {
  els.dayFilter.value = ''
  render()
})

els.calendarHeatmap.addEventListener('click', event => {
  const button = event.target.closest('[data-day]')
  if (!button) return
  els.dayFilter.value = button.dataset.day
  render()
  window.scrollTo({ top: 0, behavior: 'smooth' })
})

els.goalList.addEventListener('click', event => {
  const button = event.target.closest('[data-delete-goal]')
  if (!button) return
  settings.goals = settings.goals.filter(goal => goal.id !== button.dataset.deleteGoal)
  saveSettings()
  render()
})

els.transactionTable.addEventListener('change', event => {
  const categoryControl = event.target.closest('[data-category-key]')
  const noteControl = event.target.closest('[data-note-key]')
  if (categoryControl) {
    settings.transactionMeta[categoryControl.dataset.categoryKey] = {
      ...settings.transactionMeta[categoryControl.dataset.categoryKey],
      category: categoryControl.value
    }
    saveSettings()
    render()
  }
  if (noteControl) {
    settings.transactionMeta[noteControl.dataset.noteKey] = {
      ...settings.transactionMeta[noteControl.dataset.noteKey],
      note: noteControl.value.trim()
    }
    saveSettings()
  }
})

document.addEventListener('click', event => {
  const searchButton = event.target.closest('[data-search-text]')
  const periodButton = event.target.closest('[data-period-day]')
  if (searchButton) {
    els.searchInput.value = searchButton.dataset.searchText
    render()
  }
  if (periodButton) {
    els.dayFilter.value = periodButton.dataset.periodDay
    render()
  }
})

els.clearButton.addEventListener('click', () => {
  state.sourceName = null
  state.account = null
  state.accounts = []
  state.transactions = []
  setStatus('PDF жүктеңіз')
  els.fileInput.value = ''
  els.searchInput.value = ''
  els.typeFilter.value = 'all'
  els.periodFilter.value = 'all'
  els.timeGroup.value = 'auto'
  els.dayFilter.value = ''
  els.dayFilter.removeAttribute('min')
  els.dayFilter.removeAttribute('max')
  render()
})

els.exportButton.addEventListener('click', () => {
  exportCsv(state.filtered)
})

document.getElementById('exportExcelButton').addEventListener('click', () => {
  exportExcel(state.filtered)
})

document.getElementById('exportWordButton').addEventListener('click', () => {
  exportWord(state.filtered)
})

document.getElementById('exportPdfButton').addEventListener('click', () => {
  exportPdf(state.filtered)
})

els.exportJsonButton.addEventListener('click', () => {
  exportJson(state.filtered)
})

els.reportButton.addEventListener('click', () => {
  exportHtmlReport()
})

window.addEventListener('resize', () => {
  drawDailyChart(els.dailyChart, buildTimeStats(state.filtered).items)
})

// === FILE PROCESSOR ===

async function handleFiles(files) {
  const pdfFiles = files.filter(file => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))
  if (pdfFiles.length === 0) {
    setStatus('PDF файлын таңдаңыз', true)
    return
  }

  setStatus('PDF оқылып жатыр...')

  try {
    const parsedStatements = []
    let detectedBankCode = state.activeBank // Default fallback to active selection

    for (const file of pdfFiles) {
      const text = await readPdfText(file)
      
      // Auto-detect the bank format from PDF text content
      const autoBank = autoDetectBank(text)
      if (autoBank) {
        detectedBankCode = autoBank
      }

      if (!detectedBankCode) {
        throw new Error(`${file.name}: бұл қолдау көрсетілетін банк көшірмесіне ұқсамайды. Алдымен банкті таңдаңыз.`)
      }

      // If detected bank differs from current select state, shift it
      if (state.activeBank !== detectedBankCode) {
        selectBank(detectedBankCode, true)
      }

      // Invoke specific bank parsing models
      const parsed = BANKS[detectedBankCode].parser(text, file.name)
      parsedStatements.push(parsed)
    }

    const transactions = dedupeTransactions(parsedStatements.flatMap(s => s.transactions))
    markTransitTransactions(transactions)
    const latestAccount = parsedStatements
      .map(s => s.account)
      .sort((a, b) => new Date(b.statementDate) - new Date(a.statementDate))[0]

    state.sourceName = pdfFiles.map(file => file.name).join(', ')
    state.account = latestAccount
    state.accounts = parsedStatements.map(s => s.account)
    state.transactions = transactions.sort((a, b) => b.date - a.date)
    
    els.searchInput.value = ''
    els.typeFilter.value = 'all'
    els.periodFilter.value = 'all'
    els.timeGroup.value = 'auto'
    els.dayFilter.value = ''
    
    setDayFilterBounds(state.transactions)
    setStatus(`${state.transactions.length} транзакция оқылды`)
    
    const filePanel = document.getElementById('filePanel')
    if (filePanel) {
      filePanel.classList.remove('collapsed')
    }
    
    render()
  } catch (error) {
    console.error(error)
    setStatus(error.message || String(error), true)
  }
}

function autoDetectBank(text) {
  for (const code in BANKS) {
    if (BANKS[code].detect(text)) {
      return code
    }
  }
  return null
}

async function readPdfText(file) {
  if (!window.pdfjsLib) {
    throw new Error('PDF parser жүктелмеді')
  }
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise
  let fullText = ''
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent({
      normalizeWhitespace: false,
      disableCombineTextItems: true
    })
    let pageText = ''
    let lastY = null
    for (const item of content.items) {
      const y = item.transform?.[5]
      if (lastY === null) {
        pageText += item.str
      } else if (y === lastY) {
        pageText += ' ' + item.str
      } else {
        pageText += '\n' + item.str
      }
      lastY = y
    }
    fullText += '\n' + pageText
  }
  return fullText
}

// === 1. KASPI PARSING MODEL ===
function parseKaspi(text, fileName) {
  const accountId = firstMatch(text, [
    /Номер счета:\s*([A-Z0-9]+)/,
    /Account number:\s*([A-Z0-9]+)/,
    /Шот нөмірі:\s*([A-Z0-9]+)/
  ])
  const cardNumber = firstOptionalMatch(text, [
    /Номер карты:\s*(\*\d+)/,
    /Card number:\s*(\*\d+)/,
    /Карта нөмірі:\s*(\*\d+)/
  ])
  
  const balanceMatch = firstDetailedMatch(text, [
    /Доступно\s+на\s+(\d{2}[-./]\d{2}[-./]\d{2,4}):\s*(?:\+\s*)?(-?[\d\s.,]*\d)\s*([а-яА-Яa-zA-Z]{1,3}|\W)/,
    /Card balance\s+((\d\d\.?){3}):\s*(?:\+\s*)?(-?[\d\s.,]*\d)/,
    /((\d\d\.?){3})ж\.\s*қолжетімді:\s*(?:\+\s*)?(-?[\d\s.,]*\d)/
  ])
  const balance = balanceMatch ? parseNumber(balanceMatch[2] || balanceMatch[1] || '0') : 0
  
  const statementDate = firstOptionalMatch(text, [
    /Доступно\s+на\s+((\d\d\.?){3}):/,
    /Card balance\s+((\d\d\.?){3}):/,
    /((\d\d\.?){3})ж\.\s*қолжетімді:/
  ])
  
  const period = parsePeriodCommon(text)
  const title = cardNumber ? `Kaspi Gold ${cardNumber}` : 'Kaspi Gold'
  const signatureCounts = {}
  
  const transactions = parseTransactionsKaspi(text).map((transaction, index) => {
    const signature = buildTransactionSignature(accountId, transaction)
    signatureCounts[signature] = (signatureCounts[signature] || 0) + 1
    const key = `${signature}:${signatureCounts[signature]}`
    return {
      ...transaction,
      id: key,
      key,
      accountId,
      source: fileName,
      sourceIndex: index
    }
  })

  return {
    account: {
      id: accountId,
      title,
      balance,
      period,
      statementDate: statementDate ? parseDate(statementDate) : new Date()
    },
    transactions
  }
}

function parseTransactionsKaspi(text) {
  const lines = text.split('\n')
  const transactions = []
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (!/^\s*\d{2}\.\d{2}\.\d{2}(?:\s+\d{2}:\d{2})?\s*[+-]/.test(line)) continue

    const nextLine = lines[index + 1] || ''
    const originalAmount = /^\s*\(?\s*[-+]?\s*[\d\s.,]+\s*[A-Z]{3}\s*\)?\s*$/.test(nextLine) ? nextLine.trim() : null
    if (originalAmount) index++

    const match = line.match(/^\s*(\d{2}\.\d{2}\.\d{2})(?:\s+(\d{2}:\d{2}))?\s*([+-])\s*([\d\s.,]+)\s*([^\d\s]+)\s+(.+?)\s{2,}(.+?)\s*$/)
    if (match) {
      const [, dateText, timeText, sign, amountText, currency, operation, description] = match
      let amount = parseNumber(amountText) * (sign === '-' ? -1 : 1)
      const type = normalizeTypeCommon(operation, description, amount)
      const category = categorizeCommon({ type, operation, description, amount })
      const time = timeText || ''
      transactions.push({
        id: `${dateText}:${time}:${amount}:${operation}:${description}`,
        date: parseDate(dateText, time),
        dateText,
        time,
        amount,
        currency: mapCurrency(currency),
        operation: operation.trim(),
        description: description.trim(),
        originalAmount,
        type,
        category
      })
    }
  }
  return transactions
}

// === 2. HALYK PARSING MODEL ===
function parseHalyk(text, fileName) {
  // Extract all accounts & their currencies
  const accountsFound = []
  const accountRegex = /Шот нөмірі\s+([A-Z]{3}):\s*([A-Z0-9]+)/gi
  let accMatch
  while ((accMatch = accountRegex.exec(text)) !== null) {
    accountsFound.push({ currency: mapCurrency(accMatch[1]), iban: accMatch[2] })
  }

  let accountId = accountsFound.length > 0 ? accountsFound[0].iban : (firstOptionalMatch(text, [
    /Номер счета:\s*([A-Z0-9]+)/i,
    /Account number:\s*([A-Z0-9]+)/i,
    /Шот нөмірі:\s*([A-Z0-9]+)/i,
    /IBAN:\s*([A-Z0-9]+)/i
  ]) || 'KZ-HALYK-STATEMENT')

  const cardNumber = firstOptionalMatch(text, [
    /Номер карты:\s*([\*\d]+)/i,
    /Card number:\s*([\*\d]+)/i,
    /Карта нөмірі:\s*([\*\d]+)/i
  ])

  const balanceMatch = firstDetailedMatch(text, [
    /қолжетімді сома.*:\s*(-?[\d\s.,\u00A0]*\d)\s*KZT/i,
    /Доступно\s+на\s+(\d{2}[-./]\d{2}[-./]\d{2,4}):\s*(?:\+\s*)?(-?[\d\s.,\u00A0]*\d)\s*([а-яА-Яa-zA-Z]{1,3}|\W)/i,
    /Конечный\s+баланс:\s*(?:\+\s*)?(-?[\d\s.,\u00A0]*\d)/i,
    /Баланс:\s*(?:\+\s*)?(-?[\d\s.,\u00A0]*\d)/i
  ])
  const balance = balanceMatch ? parseNumber(balanceMatch[1] || balanceMatch[balanceMatch.length - 2] || '0') : 0

  const statementDate = firstOptionalMatch(text, [
    /Үзінді көшірме жасалған күн:\s*((\d\d\.?){3})/i,
    /Доступно\s+на\s+((\d\d\.?){3})/i,
    /Дата выписки:\s*((\d\d\.?){3})/i
  ])
  const period = parsePeriodCommon(text)
  const title = cardNumber ? `Halyk Card ${cardNumber}` : 'Halyk Card'
  const signatureCounts = {}

  const transactions = parseTransactionsHalyk(text).map((transaction, index) => {
    const txAccountId = transaction.accountId || accountId
    const signature = buildTransactionSignature(txAccountId, transaction)
    signatureCounts[signature] = (signatureCounts[signature] || 0) + 1
    const key = `${signature}:${signatureCounts[signature]}`
    return {
      ...transaction,
      id: key,
      key,
      accountId: txAccountId,
      source: fileName,
      sourceIndex: index
    }
  })

  return {
    account: {
      id: accountId,
      title,
      balance,
      period,
      statementDate: statementDate ? parseDate(statementDate) : new Date()
    },
    transactions
  }
}

function parseTransactionsHalyk(text) {
  const lines = text.split('\n')
  const transactions = []
  
  let currentAccountNo = null
  let currentAccountCurrency = 'KZT'
  
  const sectionHeaderRegex = /Шот нөмірі\s+([A-Z]{3}):\s*([A-Z0-9]+)/i
  const blockStartRegex = /^\s*(\d{2}\.\d{2}\.\d{4})\s+(\d{2}\.\d{2}\.\d{4})(?:\s+(.*))?$/
  const amountLineRegex = /(-?[\d\s\u00A0]+,\d{2})\s+([A-Z]{3}|₸)\s+(-?[\d\s\u00A0]+,\d{2})\s+(-?[\d\s\u00A0]+,\d{2})\s+(-?[\d\s\u00A0]+,\d{2})\s+(\S+)/i

  let activeBlock = null

  function finalizeBlock() {
    activeBlock = null
  }

  function cleanAmountText(str) {
    if (!str) return 0
    const cleaned = str.replace(/[\s\u00A0]/g, '').replace(/,/g, '.')
    return Number(cleaned) || 0
  }

  function isJunkLine(textLine) {
    const junkPatterns = [
      /Операция\s+жүргізілген/i,
      /Операция\s+өңделген/i,
      /Операцияның\s+сипаттамасы/i,
      /Операция\s+сомасы/i,
      /Операция\s+валютасы/i,
      /Шот\s+валютасындағы/i,
      /кіріс|шығыс/i,
      /Комиссия\s+Карточка/i,
      /Шоты\s+бойынша\s+үзінді\s+көшірме/i,
      /Барлығы:/i,
      /Банк\s+мөрінің/i,
      /болған\s+кезде/i,
      /жүргізілген\s+күн/i,
      /өңделген\s+күн/i,
      /сипаттамасы/i,
      /сомасы/i,
      /валютасы/i,
      /кіріс/i,
      /шығыс/i,
      /Комиссия/i,
      /Карточка\/шот/i
    ]
    return junkPatterns.some(p => p.test(textLine))
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const sectionMatch = line.match(sectionHeaderRegex)
    if (sectionMatch) {
      finalizeBlock()
      currentAccountCurrency = mapCurrency(sectionMatch[1])
      currentAccountNo = sectionMatch[2]
      continue
    }

    const blockStartMatch = line.match(blockStartRegex)
    if (blockStartMatch) {
      finalizeBlock()
      
      const dateText = blockStartMatch[1]
      const dateText2 = blockStartMatch[2]
      const rest = (blockStartMatch[3] || '').trim()

      activeBlock = {
        dateText,
        dateText2,
        descriptionLines: [],
        accountId: currentAccountNo,
        accountCurrency: currentAccountCurrency
      }

      if (rest) {
        const inlineMatch = rest.match(amountLineRegex)
        if (inlineMatch) {
          const rawAmount = inlineMatch[1]
          const currency = mapCurrency(inlineMatch[2])
          const incomeVal = cleanAmountText(inlineMatch[3])
          const expenseVal = cleanAmountText(inlineMatch[4])
          const commissionVal = cleanAmountText(inlineMatch[5])
          const cardNo = inlineMatch[6]

          let amount = cleanAmountText(rawAmount)
          const description = rest.substring(0, inlineMatch.index).trim()
          
          let operation = 'Басқа'
          if (/оплата|покупка|зат сатып алу|плата/i.test(description)) {
            operation = 'Зат сатып алу'
          } else if (/перевод|аударым|трансфер/i.test(description)) {
            operation = 'Аударым'
          } else if (/снятие|ақша алу|atm/i.test(description)) {
            operation = 'Қолма-қол'
          } else if (/пополнение|толықтыру|зачисление|получено|түсім/i.test(description)) {
            operation = 'Кіріс'
          } else if (amount > 0) {
            operation = 'Кіріс'
          } else {
            operation = 'Зат сатып алу'
          }

          const type = normalizeTypeCommon(operation, description, amount)
          const category = categorizeCommon({ type, operation, description, amount })

          transactions.push({
            id: `${dateText}:${amount}:${operation}:${description}`,
            date: parseDate(dateText),
            dateText,
            time: '',
            amount,
            currency,
            operation,
            description,
            originalAmount: null,
            type,
            category,
            accountId: activeBlock.accountId
          })

          activeBlock = null
        } else {
          if (!isJunkLine(rest)) {
            activeBlock.descriptionLines.push(rest)
          }
        }
      }
      continue
    }

    if (activeBlock) {
      const amountMatch = line.match(amountLineRegex)
      if (amountMatch) {
        const rawAmount = amountMatch[1]
        const currency = mapCurrency(amountMatch[2])
        const incomeVal = cleanAmountText(amountMatch[3])
        const expenseVal = cleanAmountText(amountMatch[4])
        const commissionVal = cleanAmountText(amountMatch[5])
        const cardNo = amountMatch[6]

        let amount = cleanAmountText(rawAmount)

        const description = activeBlock.descriptionLines
          .map(l => l.trim())
          .filter(l => l.length > 0)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()

        let operation = 'Басқа'
        if (/оплата|покупка|зат сатып алу|плата/i.test(description)) {
          operation = 'Зат сатып алу'
        } else if (/перевод|аударым|трансфер/i.test(description)) {
          operation = 'Аударым'
        } else if (/снятие|ақша алу|atm/i.test(description)) {
          operation = 'Қолма-қол'
        } else if (/пополнение|толықтыру|зачисление|получено|түсім/i.test(description)) {
          operation = 'Кіріс'
        } else if (amount > 0) {
          operation = 'Кіріс'
        } else {
          operation = 'Зат сатып алу'
        }

        const type = normalizeTypeCommon(operation, description, amount)
        const category = categorizeCommon({ type, operation, description, amount })

        transactions.push({
          id: `${activeBlock.dateText}:${amount}:${operation}:${description}`,
          date: parseDate(activeBlock.dateText),
          dateText: activeBlock.dateText,
          time: '',
          amount,
          currency,
          operation,
          description,
          originalAmount: null,
          type,
          category,
          accountId: activeBlock.accountId
        })

        activeBlock = null
      } else {
        if (!isJunkLine(line)) {
          activeBlock.descriptionLines.push(line)
        }
      }
    }
  }

  return transactions
}

// === 3. FORTE PARSING MODEL ===
function parseForte(text, fileName) {
  const accountId = firstOptionalMatch(text, [/Номер счета:\s*([A-Z0-9]+)/i, /IBAN:\s*([A-Z0-9]+)/i]) || 'KZ-FORTE-STATEMENT'
  const cardNumber = firstOptionalMatch(text, [/Номер карты:\s*([\*\d]+)/i, /Карта:\s*([\*\d]+)/i])
  const balanceMatch = firstDetailedMatch(text, [/Баланс:\s*(?:\+\s*)?(-?[\d\s.,]*\d)/i, /Итого:\s*(?:\+\s*)?(-?[\d\s.,]*\d)/i])
  const balance = balanceMatch ? parseNumber(balanceMatch[1]) : 0

  const period = parsePeriodCommon(text)
  const title = cardNumber ? `Forte Card ${cardNumber}` : 'Forte Card'
  const signatureCounts = {}

  const transactions = parseTransactionsForte(text).map((transaction, index) => {
    const signature = buildTransactionSignature(accountId, transaction)
    signatureCounts[signature] = (signatureCounts[signature] || 0) + 1
    const key = `${signature}:${signatureCounts[signature]}`
    return {
      ...transaction,
      id: key,
      key,
      accountId,
      source: fileName,
      sourceIndex: index
    }
  })

  return {
    account: {
      id: accountId,
      title,
      balance,
      period,
      statementDate: new Date()
    },
    transactions
  }
}

function parseTransactionsForte(text) {
  const lines = text.split('\n')
  const transactions = []
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (!/^\s*\d{2}\.\d{2}\.\d{2,4}/.test(line)) continue

    const match = line.match(/^\s*(\d{2}\.\d{2}\.\d{2,4})(?:\s+(\d{2}:\d{2}))?\s*([+-])?\s*([\d\s.,]+)\s*(KZT|₸|[A-Z]{3})\s+(.+)$/i)
    if (match) {
      let [, dateText, timeText, sign, amountText, currency, details] = match
      let amount = parseNumber(amountText)
      details = details.trim()
      
      let operation = 'Басқа'
      let description = details

      if (/покупка|оплата|retail|pay/i.test(details)) {
        operation = 'Зат сатып алу'
        if (!sign) sign = '-'
      } else if (/перевод|transfer|p2p/i.test(details)) {
        operation = 'Аударым'
      } else if (/снятие|cash|atm/i.test(details)) {
        operation = 'Қолма-қол'
        if (!sign) sign = '-'
      } else if (/зачисление|пополнение|incoming|salary/i.test(details)) {
        operation = 'Кіріс'
        if (!sign) sign = '+'
      }

      amount = amount * (sign === '-' ? -1 : 1)
      const type = normalizeTypeCommon(operation, description, amount)
      const category = categorizeCommon({ type, operation, description, amount })
      const time = timeText || ''

      transactions.push({
        id: `${dateText}:${time}:${amount}:${operation}:${description}`,
        date: parseDate(dateText, time),
        dateText,
        time,
        amount,
        currency: mapCurrency(currency),
        operation,
        description,
        originalAmount: null,
        type,
        category
      })
    }
  }
  return transactions
}

// === 4. JUSAN PARSING MODEL ===
function parseJusan(text, fileName) {
  const accountId = firstOptionalMatch(text, [/Номер счета:\s*([A-Z0-9]+)/i, /IBAN:\s*([A-Z0-9]+)/i, /Шот нөмірі:\s*([A-Z0-9]+)/i]) || 'KZ-JUSAN-STATEMENT'
  const cardNumber = firstOptionalMatch(text, [/Карта:\s*([\*\d]+)/i, /Карточка нөмірі:\s*([\*\d]+)/i])
  const balanceMatch = firstDetailedMatch(text, [
    /Доступно:\s*(-?[\d\s.,]*\d)/i,
    /Баланс:\s*(-?[\d\s.,]*\d)/i,
    /жылға қалдық\s*(-?[\d\s.,]*\d)/i,
    /жалпы қалдық\s*(-?[\d\s.,]*\d)/i
  ])
  const balance = balanceMatch ? parseNumber(balanceMatch[1]) : 0

  const period = parsePeriodCommon(text)
  const title = cardNumber ? `Alatau Card ${cardNumber}` : 'Alatau Card'
  const signatureCounts = {}

  const transactions = parseTransactionsJusan(text).map((transaction, index) => {
    const signature = buildTransactionSignature(accountId, transaction)
    signatureCounts[signature] = (signatureCounts[signature] || 0) + 1
    const key = `${signature}:${signatureCounts[signature]}`
    return {
      ...transaction,
      id: key,
      key,
      accountId,
      source: fileName,
      sourceIndex: index
    }
  })

  return {
    account: {
      id: accountId,
      title,
      balance,
      period,
      statementDate: new Date()
    },
    transactions
  }
}

function parseTransactionsJusan(text) {
  const transactions = []
  
  // Find all sections starting with "Шот бойынша транзакциялар"
  const sections = text.split(/Шот бойынша транзакциялар/i)
  
  for (let s = 1; s < sections.length; s++) {
    const sectionText = sections[s]
    
    // Extract the IBAN and Currency of this section
    const headerMatch = sectionText.match(/:\s*([A-Z0-9]+)\s*([A-Z]{3})/i)
    if (!headerMatch) continue
    const sectionCurrency = mapCurrency(headerMatch[2])
    
    // Split the section text by dates to get transaction blocks
    const parts = sectionText.split(/\b(\d{2}\.\d{2}\.\d{4})\b/)
    if (parts.length < 3) continue
    
    for (let i = 1; i < parts.length; i += 2) {
      const dateText = parts[i]
      const blockText = parts[i + 1]
      if (!blockText) continue
      
      const cleanBlock = blockText.replace(/\s+/g, ' ').trim()
      
      // Extract time
      const timeMatch = cleanBlock.match(/\b(\d{2}:\d{2}(?::\d{2})?)\b/)
      const time = timeMatch ? timeMatch[1] : ''
      
      // Extract amounts and currency using our tail regex
      const tailRegex = /([\d\s.,]+)\s*(KZT|₸|[A-Z]{3})\s+([\d\s.,]+)\s+([\d\s.,]+)\b/i
      const tailMatch = cleanBlock.match(tailRegex)
      if (!tailMatch) continue
      
      const [, amountText, currencyText, incomeText, expenseText] = tailMatch
      const income = parseNumber(incomeText)
      const expense = parseNumber(expenseText)
      
      if (income === 0 && expense === 0) continue // Skip zero placeholders
      
      const amount = income > 0 ? income : -expense
      
      // Extract description
      let descriptionText = cleanBlock
      if (timeMatch) {
        const timeIndex = cleanBlock.indexOf(timeMatch[0])
        descriptionText = cleanBlock.substring(timeIndex + timeMatch[0].length).trim()
      }
      const tailIndex = descriptionText.indexOf(tailMatch[0])
      if (tailIndex !== -1) {
        descriptionText = descriptionText.substring(0, tailIndex).trim()
      }
      
      // Clean description
      descriptionText = descriptionText.replace(/\s+/g, ' ').trim()
      
      let type = 'other'
      let operation = 'Басқа'
      
      if (income > 0) {
        type = 'income'
        operation = 'Кіріс'
      } else if (expense > 0) {
        if (/покупка|оплата|jusan pay|web|Төлем|BILL|LEGION|SHOP|YANDEX|GOOGLE|ChatGPT/i.test(descriptionText)) {
          type = 'purchase'
          operation = 'Зат сатып алу'
        } else if (/перевод|аударым|p2p/i.test(descriptionText)) {
          type = 'transfer'
          operation = 'Аударым'
        } else if (/снятие|ақша алу|atm|Шешу/i.test(descriptionText)) {
          type = 'cash'
          operation = 'Қолма-қол'
        } else {
          type = 'purchase'
          operation = 'Зат сатып алу'
        }
      }
      
      const category = categorizeCommon({ type, operation, description: descriptionText, amount })
      
      transactions.push({
        id: `${dateText}:${time}:${amount}:${operation}:${descriptionText}`,
        date: parseDate(dateText, time),
        dateText,
        time,
        amount,
        currency: mapCurrency(currencyText || sectionCurrency),
        operation,
        description: descriptionText,
        originalAmount: null,
        type,
        category
      })
    }
  }
  
  return transactions
}


// === 5. BCC (BANK CENTERCREDIT) PARSING MODEL ===
function parseBcc(text, fileName) {
  const accountId = firstOptionalMatch(text, [/Номер счета:\s*([A-Z0-9]+)/i, /IBAN:\s*([A-Z0-9]+)/i]) || 'KZ-BCC-STATEMENT'
  const cardNumber = firstOptionalMatch(text, [/Карта:\s*([\*\d]+)/i])
  const balanceMatch = firstDetailedMatch(text, [/Баланс:\s*(-?[\d\s.,]*\d)/i, /Итоговый:\s*(-?[\d\s.,]*\d)/i])
  const balance = balanceMatch ? parseNumber(balanceMatch[1]) : 0

  const period = parsePeriodCommon(text)
  const title = cardNumber ? `BCC Card ${cardNumber}` : 'BCC Card'
  const signatureCounts = {}

  const transactions = parseTransactionsBcc(text).map((transaction, index) => {
    const signature = buildTransactionSignature(accountId, transaction)
    signatureCounts[signature] = (signatureCounts[signature] || 0) + 1
    const key = `${signature}:${signatureCounts[signature]}`
    return {
      ...transaction,
      id: key,
      key,
      accountId,
      source: fileName,
      sourceIndex: index
    }
  })

  return {
    account: {
      id: accountId,
      title,
      balance,
      period,
      statementDate: new Date()
    },
    transactions
  }
}

function parseTransactionsBcc(text) {
  const lines = text.split('\n')
  const transactions = []
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (!/^\s*\d{2}\.\d{2}\.\d{2,4}/.test(line)) continue

    const match = line.match(/^\s*(\d{2}\.\d{2}\.\d{2,4})(?:\s+(\d{2}:\d{2}))?\s*([+-])?\s*([\d\s.,]+)\s*(KZT|₸|[A-Z]{3})\s+(.+)$/i)
    if (match) {
      let [, dateText, timeText, sign, amountText, currency, details] = match
      let amount = parseNumber(amountText)
      details = details.trim()

      let operation = 'Басқа'
      let description = details

      if (/покупка|оплата|bcc pay|pos/i.test(details)) {
        operation = 'Зат сатып алу'
        if (!sign) sign = '-'
      } else if (/перевод|аударым|p2p/i.test(details)) {
        operation = 'Аударым'
      } else if (/снятие|cash|atm/i.test(details)) {
        operation = 'Қолма-қол'
        if (!sign) sign = '-'
      } else if (/зачисление|пополнение|зарплата|incoming/i.test(details)) {
        operation = 'Кіріс'
        if (!sign) sign = '+'
      }

      amount = amount * (sign === '-' ? -1 : 1)
      const type = normalizeTypeCommon(operation, description, amount)
      const category = categorizeCommon({ type, operation, description, amount })
      const time = timeText || ''

      transactions.push({
        id: `${dateText}:${time}:${amount}:${operation}:${description}`,
        date: parseDate(dateText, time),
        dateText,
        time,
        amount,
        currency: mapCurrency(currency),
        operation,
        description,
        originalAmount: null,
        type,
        category
      })
    }
  }
  return transactions
}

// === UTILITIES AND SUPPORTIVE METHODS ===

function parsePeriodCommon(text) {
  const normalized = text.replace(/\s+/g, ' ')
  const match = normalized.match(/(\d{2}\.\d{2}\.\d{2,4})ж?\.\s*бастап\s*(\d{2}\.\d{2}\.\d{2,4})ж?\.\s*дейінгі/i) ||
    normalized.match(/from\s*(\d{2}\.\d{2}\.\d{2,4})\s*to\s*(\d{2}\.\d{2}\.\d{2,4})/i) ||
    normalized.match(/с\s*(\d{2}\.\d{2}\.\d{2,4})\s*по\s*(\d{2}\.\d{2}\.\d{2,4})/i)
  if (!match) {
    return 'Кезең анықталмады'
  }
  return `${match[1]} - ${match[2]}`
}

function normalizeTypeCommon(operation, description, amount) {
  const text = `${operation} ${description}`.toLowerCase()
  if (/снятие|withdrawals|ақша алу|atm|банкомат/.test(text)) {
    return 'cash'
  }
  if (/перевод|transfers|аударым/.test(text)) {
    return amount > 0 ? 'income' : 'transfer'
  }
  if (/пополнение|replenishment|толықтыру|зачисление/.test(text)) {
    return 'income'
  }
  if (/покупка|purchases|зат сатып алу|плата|оплата/.test(text)) {
    return 'purchase'
  }
  return amount > 0 ? 'income' : 'other'
}

function categorizeCommon({ type, description, amount }) {
  const text = description.toLowerCase()
  if (type === 'income') {
    return amount > 0 ? 'Кіріс' : 'Қайтарым'
  }
  if (type === 'transfer') {
    return 'Аударым'
  }
  if (/комис|fee|charge/.test(text)) {
    return 'Комиссия'
  }
  if (/onay|билет|жол ақы|теңгерімді толтыру/.test(text)) {
    return 'Көлік'
  }
  if (/apteka|аптека|apotheke|omega|pharma|дәріхана/.test(text)) {
    return 'Дәріхана'
  }
  if (/clinic|клиник|мед|стомат|dent|optika|оптика/.test(text)) {
    return 'Денсаулық'
  }
  if (/magnum|магазин|маркет|мини|minimarket|cash&carry|южный|алатау|small|galmart|arbuz/.test(text)) {
    return 'Азық-түлік'
  }
  if (/maki|belissimo|food|cafe|coffee|кофе|restaurant|restoran|burger|kfc|doner|pizza|пицца/.test(text)) {
    return 'Тамақ'
  }
  if (/activ|kcell|tele2|beeline|internet|интернет|байланыс/.test(text)) {
    return 'Байланыс'
  }
  if (/ticket|freedom media|tilda|netflix|spotify|apple|google|yandex|яндекс/.test(text)) {
    return 'Сервис'
  }
  if (/кино|cinema|театр|ойын|playstation|steam/.test(text)) {
    return 'Демалыс'
  }
  if (/school|курс|университет|оқу|education|book|кітап/.test(text)) {
    return 'Білім'
  }
  if (/zara|lc waikiki|waikiki|киім|clothes|sulpak|mechta|technodom/.test(text)) {
    return 'Киім'
  }
  if (type === 'cash') {
    return 'Қолма-қол'
  }
  return type === 'purchase' ? 'Сатып алу' : 'Басқа'
}

function buildTransactionSignature(accountId, transaction) {
  return `${accountId}:${transaction.dateText}:${transaction.amount}:${transaction.operation}`
}

function dedupeTransactions(transactions) {
  const seen = new Set()
  return transactions.filter(t => {
    if (seen.has(t.id)) return false
    seen.add(t.id)
    return true
  })
}

function markTransitTransactions(transactions) {
  const map = {}
  for (const t of transactions) {
    const key = `${t.dateText}:${Math.abs(t.amount)}`
    if (!map[key]) map[key] = []
    map[key].push(t)
  }
  for (const key in map) {
    const list = map[key]
    if (list.length >= 2) {
      const negative = list.filter(t => t.amount < 0)
      const positive = list.filter(t => t.amount > 0)
      const pairs = Math.min(negative.length, positive.length)
      for (let i = 0; i < pairs; i++) {
        negative[i].isTransit = true
        positive[i].isTransit = true
      }
    }
  }
}

function isInternalTransfer(transaction) {
  return transaction.isTransit || /перевод между своими/i.test(transaction.description)
}

function firstMatch(text, regexes) {
  for (const rx of regexes) {
    const match = text.match(rx)
    if (match) return match[1].trim()
  }
  throw new Error('Керекті дерек табылмады')
}

function firstOptionalMatch(text, regexes) {
  for (const rx of regexes) {
    const match = text.match(rx)
    if (match) return match[1].trim()
  }
  return null
}

function firstDetailedMatch(text, regexes) {
  for (const rx of regexes) {
    const match = text.match(rx)
    if (match) return match
  }
  return null
}

function parseNumber(str) {
  if (!str) return 0
  const cleaned = str.replace(/\s/g, '').replace(/,/g, '.')
  return Number(cleaned) || 0
}

function parseDate(dateStr, timeStr = '') {
  const parts = dateStr.split(/[-./]/)
  if (parts.length < 3) return new Date()
  let day = Number(parts[0])
  let month = Number(parts[1]) - 1
  let year = Number(parts[2])
  if (year < 100) year += 2000 // handle short years

  if (timeStr) {
    const timeParts = timeStr.split(':')
    const hrs = Number(timeParts[0]) || 0
    const mins = Number(timeParts[1]) || 0
    const secs = Number(timeParts[2]) || 0
    return new Date(year, month, day, hrs, mins, secs)
  }
  return new Date(year, month, day)
}

// mask account number when privacy mode enabled
function maskAccount(id, hide) {
  if (!id) return '-'
  if (!hide) return id
  if (id.length <= 8) return '****'
  return `${id.substring(0, 4)}***${id.substring(id.length - 4)}`
}

function getDatasetPeriod(transactions) {
  if (transactions.length === 0) return '-'
  const dates = transactions.map(t => t.date.getTime())
  const min = new Date(Math.min(...dates))
  const max = new Date(Math.max(...dates))
  return `${toInputDate(min)} - ${toInputDate(max)}`
}

function buildFilterNote(filtered, all) {
  if (all.length === 0) return 'Файл жүктелмеді'
  return `Сүзгіленді: ${filtered.length} / ${all.length} транзакция`
}

function formatMoney(amount) {
  return amount.toLocaleString('kk-KZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₸'
}

function setDayFilterBounds(transactions) {
  if (transactions.length === 0) return
  const dates = transactions.map(t => t.date.getTime())
  const min = toInputDate(new Date(Math.min(...dates)))
  const max = toInputDate(new Date(Math.max(...dates)))
  els.dayFilter.min = min
  els.dayFilter.max = max
}

function toInputDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDate(date) {
  const d = String(date.getDate()).padStart(2, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const y = date.getFullYear()
  return `${d}.${m}.${y}`
}

function formatMonth(date) {
  const months = ['Қаңтар', 'Ақпан', 'Наурыз', 'Сәуір', 'Мамыр', 'Маусым', 'Шілде', 'Тамыз', 'Қыркүйек', 'Қазан', 'Қараша', 'Желтоқсан']
  return `${months[date.getMonth()]} ${date.getFullYear()}`
}

function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function mapCurrency(currency) {
  const clean = currency.trim().toUpperCase()
  if (clean === 'KZT' || clean === '₸' || clean === 'K') return '₸'
  return clean
}

function addGroup(obj, key, val) {
  if (!obj[key]) obj[key] = { sum: 0, count: 0 }
  obj[key].sum += val
  obj[key].count++
}

function setStatus(text, isError = false) {
  els.statusLine.textContent = text
  els.statusLine.classList.toggle('negative', isError)
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        privacyMode: false,
        excludeInternal: false,
        largeAmount: 50000,
        monthlyIncomePlan: 0,
        budgets: {},
        goals: [],
        transactionMeta: {},
        ...parsed
      }
    }
  } catch (e) {
    console.error(e)
  }
  return {
    privacyMode: false,
    excludeInternal: false,
    largeAmount: 50000,
    monthlyIncomePlan: 0,
    budgets: {},
    goals: [],
    transactionMeta: {}
  }
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch (e) {
    console.error(e)
  }
}

function initializeSettingsControls() {
  els.privacyToggle.checked = settings.privacyMode
  els.excludeInternalToggle.checked = settings.excludeInternal
  els.largeAmountInput.value = settings.largeAmount
  els.incomePlanInput.value = settings.monthlyIncomePlan
  
  // Populate budget options select dropdown list
  els.budgetCategory.innerHTML = ''
  for (const cat of categoryOptions) {
    if (cat === 'Кіріс' || cat === 'Қайтарым') continue
    const opt = document.createElement('option')
    opt.value = cat
    opt.textContent = cat
    els.budgetCategory.appendChild(opt)
  }
  els.budgetAmount.value = settings.budgets[els.budgetCategory.value] || ''
}

// === FINANCIAL METRICS MATH AND ANALYSIS RENDERING ===

function applyFilters(transactions) {
  const query = els.searchInput.value.trim().toLowerCase()
  const type = els.typeFilter.value
  const selectedDay = els.dayFilter.value
  const periodDays = els.periodFilter.value === 'all' ? null : Number(els.periodFilter.value)
  const newestDate = transactions.length > 0 ? new Date(Math.max(...transactions.map(t => t.date.getTime()))) : null
  const minDate = newestDate && periodDays ? new Date(newestDate.getTime() - (periodDays - 1) * MS_PER_DAY) : null

  return transactions.filter(t => {
    const matchesType = type === 'all' || t.type === type || (type === 'income' && t.amount > 0)
    const matchesPeriod = minDate == null || t.date >= minDate
    const matchesDay = selectedDay === '' || toInputDate(t.date) === selectedDay
    const matchesInternal = !settings.excludeInternal || !isInternalTransfer(t)
    
    const category = getTransactionCategory(t)
    const note = getTransactionNote(t)
    
    const matchesQuery = query === '' ||
      t.description.toLowerCase().includes(query) ||
      t.operation.toLowerCase().includes(query) ||
      category.toLowerCase().includes(query) ||
      note.toLowerCase().includes(query)

    return matchesType && matchesPeriod && matchesDay && matchesInternal && matchesQuery
  })
}

function buildStats(transactions) {
  const stats = { income: 0, expense: 0, incomeCount: 0, expenseCount: 0, net: 0, byType: {}, byOperation: {} }
  for (const t of transactions) {
    stats.net += t.amount
    if (t.amount > 0) {
      stats.income += t.amount
      stats.incomeCount++
    } else {
      stats.expense += Math.abs(t.amount)
      stats.expenseCount++
    }
    addGroup(stats.byType, t.type, t.amount)
    addGroup(stats.byOperation, t.operation, t.amount)
  }
  return stats
}

function buildTimeStats(transactions) {
  const group = resolveTimeGroup(transactions)
  const byPeriod = {}
  for (const t of transactions) {
    const key = group === 'month' ? getMonthKey(t.date) : t.dateText
    if (!byPeriod[key]) {
      byPeriod[key] = {
        date: group === 'month' ? new Date(t.date.getFullYear(), t.date.getMonth(), 1) : t.date,
        label: group === 'month' ? formatMonth(t.date) : t.dateText,
        income: 0,
        expense: 0,
        net: 0,
        count: 0
      }
    }
    if (t.amount > 0) {
      byPeriod[key].income += t.amount
    } else {
      byPeriod[key].expense += Math.abs(t.amount)
    }
    byPeriod[key].net += t.amount
    byPeriod[key].count++
  }
  return {
    group,
    items: Object.values(byPeriod).sort((a, b) => a.date - b.date)
  }
}

function resolveTimeGroup(transactions) {
  if (els.timeGroup.value !== 'auto') return els.timeGroup.value
  if (transactions.length === 0) return 'day'
  const dates = transactions.map(t => t.date.getTime())
  const min = Math.min(...dates)
  const max = Math.max(...dates)
  return (max - min) / MS_PER_DAY > 60 ? 'month' : 'day'
}

function buildDailyStats(transactions) {
  const byDay = {}
  for (const t of transactions) {
    const key = toInputDate(t.date)
    if (!byDay[key]) {
      byDay[key] = {
        key,
        date: t.date,
        label: formatDate(t.date),
        income: 0,
        expense: 0,
        net: 0,
        count: 0,
        topDescription: '',
        topAmount: 0
      }
    }
    if (t.amount > 0) {
      byDay[key].income += t.amount
    } else {
      byDay[key].expense += Math.abs(t.amount)
      if (!byDay[key].topDescription || Math.abs(t.amount) > Math.abs(byDay[key].topAmount)) {
        byDay[key].topDescription = t.description
        byDay[key].topAmount = t.amount
      }
    }
    byDay[key].net += t.amount
    byDay[key].count++
  }
  return Object.values(byDay).sort((a, b) => a.date - b.date)
}

function buildRealStats(transactions) {
  const stats = { expense: 0, count: 0, internalMovement: 0 }
  for (const t of transactions) {
    if (isInternalTransfer(t)) {
      stats.internalMovement += Math.abs(t.amount)
      continue
    }
    if (t.amount < 0) {
      stats.expense += Math.abs(t.amount)
      stats.count++
    }
  }
  return stats
}

function buildInsights(transactions, monthContext) {
  const realStats = buildRealStats(transactions)
  const daily = buildDailyStats(transactions)
  const expenseDays = daily.filter(d => d.expense > 0)
  const noSpendDays = countNoSpendDays(transactions)
  const averageDailyExpense = expenseDays.length > 0 ? realStats.expense / expenseDays.length : 0

  const monthTransactions = getMonthTransactions(transactions, monthContext)
  const monthIncome = monthTransactions
    .filter(t => t.amount > 0 && !isInternalTransfer(t))
    .reduce((sum, t) => sum + t.amount, 0)
  const plannedIncome = settings.monthlyIncomePlan || monthIncome
  const monthExpense = buildRealStats(monthTransactions).expense
  const remaining = Math.max(0, plannedIncome - monthExpense)
  const remainingDays = monthContext?.remainingDays || 1

  let safeDailyLimit = 0
  let safeDailyMeta = 'Кіріс жоспарын орнатыңыз'
  if (plannedIncome > 0) {
    safeDailyLimit = remaining / remainingDays
    safeDailyMeta = `${remainingDays} күн қалды · қорда ${formatMoney(remaining)}`
  }

  return {
    averageDailyExpense,
    expenseDayCount: expenseDays.length,
    noSpendDays,
    safeDailyLimit,
    safeDailyMeta
  }
}

function countNoSpendDays(transactions) {
  if (transactions.length === 0) return 0
  const dates = transactions.map(t => t.date.getTime())
  const min = Math.min(...dates)
  const max = Math.max(...dates)
  const totalDays = Math.floor((max - min) / MS_PER_DAY) + 1
  const spendDays = new Set(transactions.filter(t => t.amount < 0 && !isInternalTransfer(t)).map(t => toInputDate(t.date)))
  return Math.max(0, totalDays - spendDays.size)
}

function getActiveMonthContext(filtered, all) {
  if (all.length === 0) return null
  const dates = filtered.map(t => t.date.getTime())
  if (dates.length === 0) return null
  const max = new Date(Math.max(...dates))
  const year = max.getFullYear()
  const month = max.getMonth()
  const lastDay = new Date(year, month + 1, 0).getDate()
  const remainingDays = Math.max(1, lastDay - max.getDate() + 1)
  return { year, month, remainingDays, label: formatMonth(max) }
}

function getMonthTransactions(transactions, context) {
  if (!context) return []
  return transactions.filter(t => t.date.getFullYear() === context.year && t.date.getMonth() === context.month)
}

function getTransactionCategory(transaction) {
  return settings.transactionMeta[transaction.key]?.category || transaction.category
}

function getTransactionNote(transaction) {
  return settings.transactionMeta[transaction.key]?.note || ''
}

// === RENDERERS ===

function render() {
  state.filtered = applyFilters(state.transactions)
  const stats = buildStats(state.filtered)
  const allStats = buildStats(state.transactions)
  const timeStats = buildTimeStats(state.filtered)
  const realStats = buildRealStats(state.filtered)
  const monthContext = getActiveMonthContext(state.filtered, state.transactions)
  const insights = buildInsights(state.filtered, monthContext)
  const account = state.account

  els.fileName.textContent = state.sourceName || 'Файл таңдалмады'
  els.accountId.textContent = account ? maskAccount(account.id, settings.privacyMode) : '-'
  els.cardTitle.textContent = account?.title || '-'
  els.periodText.textContent = state.transactions.length > 0 ? getDatasetPeriod(state.transactions) : '-'
  els.transactionCountSide.textContent = String(state.transactions.length)
  els.activeFilterNote.textContent = buildFilterNote(state.filtered, state.transactions)

  els.balanceChange.textContent = formatMoney(stats.net)
  els.balanceChange.classList.toggle('positive', stats.net > 0)
  els.balanceChange.classList.toggle('negative', stats.net < 0)
  
  els.balanceRange.textContent = account && state.transactions.length > 0
    ? `${formatMoney(account.balance - allStats.net)} -> ${formatMoney(account.balance)}`
    : 'Файл жүктелмеді'
  
  els.incomeTotal.textContent = formatMoney(stats.income)
  els.incomeCount.textContent = `${stats.incomeCount} операция`
  els.expenseTotal.textContent = formatMoney(stats.expense)
  els.expenseCount.textContent = `${stats.expenseCount} операция`
  els.transferTotal.textContent = formatMoney(Math.abs(stats.byType.transfer?.sum || 0))
  els.transferCount.textContent = `${stats.byType.transfer?.count || 0} операция`
  
  // Custom purchase retrieval supporting all banks
  const pSum = stats.byOperation['Зат сатып алу']?.sum ?? stats.byOperation.Покупка?.sum ?? stats.byType.purchase?.sum ?? 0
  els.purchaseTotal.textContent = formatMoney(Math.abs(pSum))
  els.purchaseCount.textContent = `${stats.byType.purchase?.count || 0} операция`
  
  els.realExpenseTotal.textContent = formatMoney(realStats.expense)
  els.realExpenseMeta.textContent = `${realStats.count} операция · ішкі қозғалыс ${formatMoney(realStats.internalMovement)}`
  
  els.dailyAverageExpense.textContent = formatMoney(insights.averageDailyExpense)
  els.dailyAverageMeta.textContent = `${insights.expenseDayCount} шығын күні · ${insights.noSpendDays} бос күн`
  els.safeDailyLimit.textContent = formatMoney(insights.safeDailyLimit)
  els.safeDailyMeta.textContent = insights.safeDailyMeta

  renderOperationBars(stats.byOperation)
  renderTopList(state.filtered)
  renderIncomePeopleList(state.filtered)
  renderPeopleList(state.filtered)
  renderPeriodList(timeStats)
  renderCalendarHeatmap(state.transactions.filter(t => !settings.excludeInternal || !isInternalTransfer(t)))
  renderDayDetail(state.filtered)
  renderBudgetList(state.filtered, monthContext)
  renderGoalList()
  renderFinanceRule(state.filtered, monthContext)
  renderLargeTransactions(state.filtered)
  renderRecurringList(state.filtered)
  renderUnusualDays(state.filtered)
  renderWeekdayList(state.filtered)
  renderTable(state.filtered)
  
  drawDailyChart(els.dailyChart, timeStats.items)
}

function renderOperationBars(byOperation) {
  els.operationBars.innerHTML = ''
  const items = Object.entries(byOperation)
    .map(([label, s]) => ({ label, ...s }))
    .sort((a, b) => Math.abs(b.sum) - Math.abs(a.sum))

  const maxVal = Math.max(...items.map(i => Math.abs(i.sum)), 1)
  const pColor = state.activeBank ? BANKS[state.activeBank].typeColors.purchase : '#6366F1'

  for (const item of items) {
    const row = document.createElement('div')
    row.className = 'bar-row'
    const share = (Math.abs(item.sum) / maxVal) * 100
    row.innerHTML = `
      <div class="bar-meta">
        <span class="list-title">${item.label} (${item.count})</span>
        <span class="list-value ${item.sum > 0 ? 'positive' : ''}">${formatMoney(item.sum)}</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width: ${share}%; background-color: ${item.sum > 0 ? '#10B981' : pColor};"></div>
      </div>
    `
    els.operationBars.appendChild(row)
  }
}

function renderTopList(transactions) {
  els.topList.innerHTML = ''
  const spendings = transactions.filter(t => t.amount < 0 && !isInternalTransfer(t))
  const byDesc = {}
  for (const t of spendings) {
    const key = t.description
    if (!byDesc[key]) byDesc[key] = { sum: 0, count: 0 }
    byDesc[key].sum += t.amount
    byDesc[key].count++
  }

  const items = Object.entries(byDesc)
    .map(([label, s]) => ({ label, ...s }))
    .sort((a, b) => a.sum - b.sum) // most negative first
    .slice(0, 10)

  if (items.length === 0) {
    els.topList.innerHTML = '<li class="list-row"><span class="list-title">Шығындар жоқ</span></li>'
    return
  }

  for (const item of items) {
    const li = document.createElement('li')
    li.className = 'list-row'
    li.innerHTML = `
      <button class="list-title" type="button" data-search-text="${item.label}" style="background: none; border: none; font: inherit; color: inherit; cursor: pointer; text-align: left;">
        🔍 ${item.label} (${item.count})
      </button>
      <span class="list-value">${formatMoney(Math.abs(item.sum))}</span>
    `
    els.topList.appendChild(li)
  }
}

// spent analytics by description list
function renderIncomePeopleList(transactions) {
  els.incomePeopleList.innerHTML = ''
  const incomes = transactions.filter(t => t.amount > 0 && !isInternalTransfer(t))
  const byDesc = {}
  for (const t of incomes) {
    const key = t.description
    if (!byDesc[key]) byDesc[key] = { sum: 0, count: 0 }
    byDesc[key].sum += t.amount
    byDesc[key].count++
  }

  const items = Object.entries(byDesc)
    .map(([label, s]) => ({ label, ...s }))
    .sort((a, b) => b.sum - a.sum)
    .slice(0, 10)

  if (items.length === 0) {
    els.incomePeopleList.innerHTML = '<li class="list-row"><span class="list-title">Кірістер жоқ</span></li>'
    return
  }

  for (const item of items) {
    const li = document.createElement('li')
    li.className = 'list-row'
    li.innerHTML = `
      <button class="list-title" type="button" data-search-text="${item.label}" style="background: none; border: none; font: inherit; color: inherit; cursor: pointer; text-align: left;">
        🔍 ${item.label} (${item.count})
      </button>
      <span class="list-value positive">${formatMoney(item.sum)}</span>
    `
    els.incomePeopleList.appendChild(li)
  }
}

function renderPeopleList(transactions) {
  els.peopleList.innerHTML = ''
  const transfers = transactions.filter(t => t.type === 'transfer' || t.type === 'income')
  const byPerson = {}
  
  for (const t of transfers) {
    const person = extractPersonName(t.description)
    if (!person) continue
    if (!byPerson[person]) byPerson[person] = { income: 0, expense: 0, count: 0 }
    if (t.amount > 0) {
      byPerson[person].income += t.amount
    } else {
      byPerson[person].expense += Math.abs(t.amount)
    }
    byPerson[person].count++
  }

  const items = Object.entries(byPerson)
    .map(([name, s]) => ({ name, ...s, net: s.income - s.expense }))
    .sort((a, b) => (b.income + b.expense) - (a.income + a.expense))
    .slice(0, 10)

  if (items.length === 0) {
    els.peopleList.innerHTML = '<li class="list-row"><span class="list-title">Адамдар табылмады</span></li>'
    return
  }

  for (const item of items) {
    const li = document.createElement('li')
    li.className = 'list-row'
    const details = []
    if (item.income > 0) details.push(`+${formatMoney(item.income)}`)
    if (item.expense > 0) details.push(`-${formatMoney(item.expense)}`)
    
    li.innerHTML = `
      <button class="list-title" type="button" data-search-text="${item.name}" style="background: none; border: none; font: inherit; color: inherit; cursor: pointer; text-align: left;">
        👤 ${item.name} (${item.count})
      </button>
      <span class="list-value ${item.net > 0 ? 'positive' : item.net < 0 ? 'negative' : ''}">
        ${details.join(' · ')} (${item.net > 0 ? '+' : ''}${formatMoney(item.net)})
      </span>
    `
    els.peopleList.appendChild(li)
  }
}

function extractPersonName(desc) {
  const match = desc.match(/(?:аударым|перевод)\s+([^.\n]+)/i) || 
    desc.match(/^(?:т\.|қ\.|д\.)\s+([^.\n]+)/i) ||
    desc.match(/^([а-яА-Яa-zA-Z\s]{4,}\s[а-яА-Яa-zA-Z\s]{1}\.)/i)
  return match ? match[1].trim() : null
}

function renderPeriodList(timeStats) {
  els.periodList.innerHTML = ''
  els.timeBreakdownLabel.textContent = timeStats.group === 'month' ? 'Айлар бойынша' : 'Күндер бойынша'
  
  const items = [...timeStats.items].reverse()
  if (items.length === 0) {
    els.periodList.innerHTML = '<li class="list-row"><span class="list-title">Кезеңдер жоқ</span></li>'
    return
  }

  for (const item of items) {
    const li = document.createElement('li')
    li.className = 'list-row'
    
    let btnHtml = ''
    if (timeStats.group === 'month') {
      btnHtml = `<span class="list-title">📅 ${item.label} (${item.count})</span>`
    } else {
      const dbDate = toInputDate(item.date)
      btnHtml = `
        <button class="list-title" type="button" data-period-day="${dbDate}" style="background: none; border: none; font: inherit; color: inherit; cursor: pointer; text-align: left;">
          📅 ${item.label} (${item.count})
        </button>
      `
    }
    
    li.innerHTML = `
      ${btnHtml}
      <span class="list-value ${item.net > 0 ? 'positive' : item.net < 0 ? 'negative' : ''}">
        +${formatMoney(item.income)} / -${formatMoney(item.expense)} (${item.net > 0 ? '+' : ''}${formatMoney(item.net)})
      </span>
    `
    els.periodList.appendChild(li)
  }
}

function renderCalendarHeatmap(transactions) {
  els.calendarHeatmap.innerHTML = ''
  if (transactions.length === 0) return

  const daily = buildDailyStats(transactions)
  if (daily.length === 0) return

  const byDay = {}
  for (const d of daily) {
    byDay[d.key] = d
  }

  // Get date range of transactions
  const dates = daily.map(d => d.date.getTime())
  const minDate = new Date(Math.min(...dates))
  const maxDate = new Date(Math.max(...dates))

  const startYear = minDate.getFullYear()
  const startMonth = minDate.getMonth()
  const endYear = maxDate.getFullYear()
  const endMonth = maxDate.getMonth()

  const monthsList = []
  let currYear = startYear
  let currMonth = startMonth

  while (currYear < endYear || (currYear === endYear && currMonth <= endMonth)) {
    monthsList.push({ year: currYear, month: currMonth })
    currMonth++
    if (currMonth > 11) {
      currMonth = 0
      currYear++
    }
  }

  const maxExpense = Math.max(...daily.map(d => d.expense), 1)
  const color = state.activeBank ? BANKS[state.activeBank].typeColors.purchase : '#6366F1'

  for (const item of monthsList) {
    const { year, month } = item
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const firstDayOfMonth = new Date(year, month, 1)
    const startDay = firstDayOfMonth.getDay() // 0 = Sun, 1 = Mon, etc.

    // Align to Monday start week: Monday=0, Tuesday=1 ... Sunday=6
    const spacerCount = startDay === 0 ? 6 : startDay - 1

    const monthContainer = document.createElement('div')
    monthContainer.className = 'month-calendar'

    let html = `<h4>${formatMonth(new Date(year, month, 1))}</h4>`
    html += `
      <div class="month-weekdays">
        <span>Дс</span><span>Сс</span><span>Ср</span><span>Бс</span><span>Жм</span><span>Сб</span><span>Жс</span>
      </div>
      <div class="month-days-grid">
    `

    // Render weekday spacers
    for (let s = 0; s < spacerCount; s++) {
      html += `<div class="day-spacer" aria-hidden="true"></div>`
    }

    // Render days of the month
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const dayKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
      const dayData = byDay[dayKey]

      if (dayData) {
        const intensity = Math.min(0.8, (dayData.expense / maxExpense) * 0.8)
        const bg = dayData.expense > 0 ? `rgba(${hexToRgb(color)}, ${0.1 + intensity})` : 'rgba(255,255,255,0.02)'
        const bc = dayData.expense > 0 ? `rgba(${hexToRgb(color)}, ${0.2 + intensity})` : 'rgba(255,255,255,0.04)'

        const textClass = dayData.net > 0 ? 'positive' : 'negative'
        const amtHtml = dayData.expense > 0
          ? '-' + Math.round(dayData.expense).toLocaleString()
          : dayData.income > 0
            ? '+' + Math.round(dayData.income).toLocaleString()
            : '0'

        html += `
          <button class="has-ops" type="button" data-day="${dayKey}" style="background-color: ${bg}; border-color: ${bc};" title="${dayData.label}: +${Math.round(dayData.income)} ₸ / -${Math.round(dayData.expense)} ₸">
            <span class="day-number">${dayNum}</span>
            <span class="${textClass}">${amtHtml}</span>
          </button>
        `
      } else {
        html += `
          <button class="silent-day" type="button" data-day="${dayKey}" title="${formatDate(new Date(year, month, dayNum))}: транзакция жоқ">
            <span class="day-number">${dayNum}</span>
            <span style="color: var(--text-muted); opacity: 0.25;">0</span>
          </button>
        `
      }
    }

    html += `</div>` // close days grid
    monthContainer.innerHTML = html
    els.calendarHeatmap.appendChild(monthContainer)
  }
}

function hexToRgb(hex) {
  const c = hex.replace('#', '')
  const r = parseInt(c.substring(0, 2), 16)
  const g = parseInt(c.substring(2, 4), 16)
  const b = parseInt(c.substring(4, 6), 16)
  return `${r}, ${g}, ${b}`
}

function renderDayDetail(transactions) {
  els.dayDetail.innerHTML = ''
  const selected = els.dayFilter.value
  if (!selected) {
    els.dayDetailLabel.textContent = 'Күн таңдалмады'
    els.dayDetail.innerHTML = '<p class="status-line">Төмендегі күнтізбеден немесе кезеңдерден күнді таңдаңыз</p>'
    return
  }

  const date = parseDate(selected)
  els.dayDetailLabel.textContent = formatDate(date)
  
  const dayOps = transactions.filter(t => toInputDate(t.date) === selected)
  if (dayOps.length === 0) {
    els.dayDetail.innerHTML = '<p class="status-line">Бұл күнде операциялар жоқ</p>'
    return
  }

  const list = document.createElement('ol')
  list.className = 'top-list'
  
  for (const t of dayOps) {
    const li = document.createElement('li')
    li.className = 'list-row'
    li.innerHTML = `
      <span class="list-title">
        <small>${t.time || '00:00'}</small> · ${t.description}
      </span>
      <span class="list-value ${t.amount > 0 ? 'positive' : 'negative'}">${formatMoney(t.amount)}</span>
    `
    list.appendChild(li)
  }
  els.dayDetail.appendChild(list)
}

function renderBudgetList(transactions, monthContext) {
  els.budgetList.innerHTML = ''
  if (!monthContext) {
    els.budgetMonthLabel.textContent = 'Ай жоқ'
    els.budgetList.innerHTML = '<li class="list-row"><span class="list-title">Файл жүктеңіз</span></li>'
    return
  }

  els.budgetMonthLabel.textContent = monthContext.label
  const monthOps = getMonthTransactions(transactions, monthContext)
  
  const spendByCat = {}
  for (const t of monthOps) {
    if (t.amount >= 0 || isInternalTransfer(t)) continue
    const cat = getTransactionCategory(t)
    spendByCat[cat] = (spendByCat[cat] || 0) + Math.abs(t.amount)
  }

  const budgets = Object.entries(settings.budgets)
  if (budgets.length === 0) {
    els.budgetList.innerHTML = '<li class="list-row"><span class="list-title">Бюджет орнатылмаған</span></li>'
    return
  }

  for (const [cat, limit] of budgets) {
    const spent = spendByCat[cat] || 0
    const pct = Math.min(100, (spent / limit) * 100)
    const li = document.createElement('li')
    li.className = 'bar-row'
    
    li.innerHTML = `
      <div class="bar-meta">
        <span class="list-title">${cat} (${formatMoney(spent)} / ${formatMoney(limit)})</span>
        <span class="list-value ${spent > limit ? 'negative' : ''}">${pct.toFixed(0)}%</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width: ${pct}%; background-color: ${spent > limit ? '#EF4444' : '#F59E0B'};"></div>
      </div>
    `
    els.budgetList.appendChild(li)
  }
}

function renderGoalList() {
  els.goalList.innerHTML = ''
  if (settings.goals.length === 0) {
    els.goalList.innerHTML = '<li class="list-row"><span class="list-title">Мақсаттар жоқ</span></li>'
    return
  }

  for (const g of settings.goals) {
    const pct = Math.min(100, (g.saved / g.target) * 100)
    const li = document.createElement('li')
    li.className = 'bar-row'
    li.innerHTML = `
      <div class="bar-meta">
        <span class="list-title">${g.name} (${formatMoney(g.saved)} / ${formatMoney(g.target)})</span>
        <button class="ghost-button compact-button" type="button" data-delete-goal="${g.id}" style="padding: 2px 6px;">Жою</button>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width: ${pct}%; background-color: #10B981;"></div>
      </div>
    `
    els.goalList.appendChild(li)
  }
}

function addGoal() {
  const name = els.goalName.value.trim()
  const target = Number(els.goalTarget.value) || 0
  const saved = Number(els.goalSaved.value) || 0
  if (!name || target <= 0) return
  
  settings.goals.push({
    id: String(Date.now()),
    name,
    target,
    saved
  })
  
  saveSettings()
  els.goalName.value = ''
  els.goalTarget.value = ''
  els.goalSaved.value = ''
  render()
}

function renderFinanceRule(transactions, monthContext) {
  if (!els.financeRule) return
  els.financeRule.innerHTML = ''
  if (!monthContext) return

  const monthOps = getMonthTransactions(transactions, monthContext)
  const income = monthOps.filter(t => t.amount > 0 && !isInternalTransfer(t)).reduce((sum, t) => sum + t.amount, 0)
  
  const spentByRule = { needs: 0, wants: 0, savings: 0 }
  for (const t of monthOps) {
    if (t.amount >= 0 || isInternalTransfer(t)) continue
    const cat = getTransactionCategory(t)
    if (/Азық-түлік|Көлік|Дәріхана|Денсаулық|Үй|Комиссия/.test(cat)) {
      spentByRule.needs += Math.abs(t.amount)
    } else if (/Тамақ|Киім|Сервис|Демалыс|Білім/.test(cat)) {
      spentByRule.wants += Math.abs(t.amount)
    } else {
      spentByRule.savings += Math.abs(t.amount)
    }
  }

  const needsLimit = income * 0.5
  const wantsLimit = income * 0.3
  const savingsLimit = income * 0.2

  els.financeRule.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 12px; font-size: 0.85rem;">
      <p>Айлық кіріс: <strong>${formatMoney(income)}</strong></p>
      
      <div class="bar-row">
        <div class="bar-meta"><span>Мұқтаждық (50%) · Лимит: ${formatMoney(needsLimit)}</span><span>${formatMoney(spentByRule.needs)}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width: ${Math.min(100, (spentByRule.needs / (needsLimit || 1)) * 100)}%; background-color: #EF4444;"></div></div>
      </div>
      
      <div class="bar-row">
        <div class="bar-meta"><span>Қалаулар (30%) · Лимит: ${formatMoney(wantsLimit)}</span><span>${formatMoney(spentByRule.wants)}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width: ${Math.min(100, (spentByRule.wants / (wantsLimit || 1)) * 100)}%; background-color: #F59E0B;"></div></div>
      </div>
      
      <div class="bar-row">
        <div class="bar-meta"><span>Жинақ / Қарыз (20%) · Лимит: ${formatMoney(savingsLimit)}</span><span>${formatMoney(spentByRule.savings)}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width: ${Math.min(100, (spentByRule.savings / (savingsLimit || 1)) * 100)}%; background-color: #10B981;"></div></div>
      </div>
    </div>
  `
}

function renderLargeTransactions(transactions) {
  els.largeTransactionList.innerHTML = ''
  const limit = settings.largeAmount
  els.largeTransactionLabel.textContent = `> ${limit.toLocaleString()} ₸`
  
  const large = transactions
    .filter(t => Math.abs(t.amount) >= limit && !isInternalTransfer(t))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))

  if (large.length === 0) {
    els.largeTransactionList.innerHTML = '<li class="list-row"><span class="list-title">Шектеуден асқандар жоқ</span></li>'
    return
  }

  for (const t of large.slice(0, 10)) {
    const li = document.createElement('li')
    li.className = 'list-row'
    li.innerHTML = `
      <span class="list-title">📅 ${t.dateText} · ${t.description}</span>
      <span class="list-value ${t.amount > 0 ? 'positive' : 'negative'}">${formatMoney(t.amount)}</span>
    `
    els.largeTransactionList.appendChild(li)
  }
}

function renderRecurringList(transactions) {
  els.recurringList.innerHTML = ''
  const spendings = transactions.filter(t => t.amount < 0 && !isInternalTransfer(t))
  const map = {}
  
  for (const t of spendings) {
    const key = `${t.description.substring(0, 12)}:${t.category}`
    if (!map[key]) map[key] = []
    map[key].push(t)
  }

  const list = Object.values(map)
    .filter(arr => arr.length >= 3)
    .map(arr => {
      const sum = arr.reduce((s, t) => s + t.amount, 0)
      return {
        description: arr[0].description,
        count: arr.length,
        average: sum / arr.length,
        sum
      }
    })
    .sort((a, b) => a.sum - b.sum)

  if (list.length === 0) {
    els.recurringList.innerHTML = '<li class="list-row"><span class="list-title">Қайталанатындар жоқ</span></li>'
    return
  }

  for (const item of list.slice(0, 5)) {
    const li = document.createElement('li')
    li.className = 'list-row'
    li.innerHTML = `
      <span class="list-title">🔁 ${item.description} (айына ${item.count} рет)</span>
      <span class="list-value">${formatMoney(Math.abs(item.average))} (орташа)</span>
    `
    els.recurringList.appendChild(li)
  }
}

function renderUnusualDays(transactions) {
  els.unusualDaysList.innerHTML = ''
  const daily = buildDailyStats(transactions.filter(t => t.amount < 0 && !isInternalTransfer(t)))
  const expenses = daily.map(d => d.expense)
  if (expenses.length === 0) {
    els.unusualDaysList.innerHTML = '<li class="list-row"><span class="list-title">Деректер жоқ</span></li>'
    return
  }

  const avg = expenses.reduce((s, e) => s + e, 0) / expenses.length
  const unusual = daily.filter(d => d.expense > avg * 2.5).sort((a, b) => b.expense - a.expense)

  if (unusual.length === 0) {
    els.unusualDaysList.innerHTML = '<li class="list-row"><span class="list-title">Қалыпты күндер</span></li>'
    return
  }

  for (const d of unusual.slice(0, 5)) {
    const li = document.createElement('li')
    li.className = 'list-row'
    li.innerHTML = `
      <span class="list-title">⚠️ ${d.label} (Шығын күні)</span>
      <span class="list-value unusual-spent-meta">${formatMoney(d.expense)} (Орташадан 2.5х көп)</span>
    `
    els.unusualDaysList.appendChild(li)
  }
}

function renderWeekdayList(transactions) {
  els.weekdayList.innerHTML = ''
  const spendings = transactions.filter(t => t.amount < 0 && !isInternalTransfer(t))
  const byDay = Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }))
  
  for (const t of spendings) {
    const day = t.date.getDay()
    byDay[day].sum += Math.abs(t.amount)
    byDay[day].count++
  }

  const items = byDay.map((s, idx) => ({
    label: weekdayLabels[idx],
    average: s.count > 0 ? s.sum / s.count : 0,
    sum: s.sum
  })).sort((a, b) => b.average - a.average)

  for (const item of items) {
    const li = document.createElement('li')
    li.className = 'list-row'
    li.innerHTML = `
      <span class="list-title">📊 ${item.label}</span>
      <span class="list-value">${formatMoney(item.average)} (күндік орташа)</span>
    `
    els.weekdayList.appendChild(li)
  }
}

function renderTable(transactions) {
  els.transactionTable.innerHTML = ''
  
  for (const t of transactions) {
    const tr = document.createElement('tr')
    const category = getTransactionCategory(t)
    const note = getTransactionNote(t)
    
    const optionsHtml = categoryOptions.map(opt => `
      <option value="${opt}" ${opt === category ? 'selected' : ''}>${opt}</option>
    `).join('')

    tr.innerHTML = `
      <td>${t.dateText} <small style="display: block; opacity: 0.6;">${t.time || ''}</small></td>
      <td>${typeLabels[t.type] || t.type}</td>
      <td>
        <strong>${t.description}</strong>
        ${t.isTransit ? '<span style="display: inline-block; background-color: var(--border); font-size: 0.7rem; padding: 2px 4px; border-radius: 4px; margin-left: 6px;">Ішкі қозғалыс</span>' : ''}
      </td>
      <td class="amount-col ${t.amount > 0 ? 'positive' : 'negative'}">${t.amount > 0 ? '+' : ''}${formatMoney(t.amount)}</td>
      <td>
        <select class="cat-badge" data-category-key="${t.key}">${optionsHtml}</select>
      </td>
      <td>
        <input class="note-field" type="text" placeholder="жазба..." value="${note}" data-note-key="${t.key}">
      </td>
    `
    els.transactionTable.appendChild(tr)
  }
}

// === CANVAS LINE CHART DRAWER ===

function drawDailyChart(canvas, items) {
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (items.length === 0) return

  const paddingLeft = 60
  const paddingRight = 40
  const paddingTop = 20
  const paddingBottom = 40
  
  const w = canvas.width - paddingLeft - paddingRight
  const h = canvas.height - paddingTop - paddingBottom

  const maxVal = Math.max(...items.flatMap(i => [i.income, i.expense, Math.abs(i.net)]), 10000)
  
  const getX = index => paddingLeft + (index / (items.length - 1 || 1)) * w
  const getY = val => paddingTop + h - (val / maxVal) * h

  // Helper lines (grid)
  ctx.strokeStyle = 'rgba(255,255,255,0.03)'
  ctx.lineWidth = 1
  for (let i = 0; i <= 4; i++) {
    const y = paddingTop + (i / 4) * h
    ctx.beginPath()
    ctx.moveTo(paddingLeft, y)
    ctx.lineTo(canvas.width - paddingRight, y)
    ctx.stroke()
    
    // Labels
    ctx.fillStyle = '#9CA3AF'
    ctx.font = '10px Roboto'
    ctx.textAlign = 'right'
    const labelVal = Math.round(maxVal - (i / 4) * maxVal)
    ctx.fillText(labelVal.toLocaleString() + ' ₸', paddingLeft - 10, y + 3)
  }

  // Draw chart lines
  drawChartLine(ctx, items, items.map(i => i.income), '#10B981')
  const pColor = state.activeBank ? BANKS[state.activeBank].typeColors.purchase : '#6366F1'
  drawChartLine(ctx, items, items.map(i => i.expense), pColor)
  
  // Date Labels (X Axis)
  ctx.fillStyle = '#9CA3AF'
  ctx.textAlign = 'center'
  const step = Math.ceil(items.length / 5)
  for (let i = 0; i < items.length; i += step) {
    ctx.fillText(items[i].label, getX(i), canvas.height - 15)
  }
}

function drawChartLine(ctx, items, vals, color) {
  const canvas = ctx.canvas
  const paddingLeft = 60
  const paddingRight = 40
  const paddingTop = 20
  const paddingBottom = 40
  
  const w = canvas.width - paddingLeft - paddingRight
  const h = canvas.height - paddingTop - paddingBottom
  const maxVal = Math.max(...items.flatMap(i => [i.income, i.expense, Math.abs(i.net)]), 10000)
  
  const getX = index => paddingLeft + (index / (items.length - 1 || 1)) * w
  const getY = val => paddingTop + h - (val / maxVal) * h

  ctx.strokeStyle = color
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(getX(0), getY(vals[0]))
  for (let i = 1; i < items.length; i++) {
    ctx.lineTo(getX(i), getY(vals[i]))
  }
  ctx.stroke()
}

// === EXPORT ENGINES ===

function exportCsv(transactions) {
  if (transactions.length === 0) return
  let csv = 'Дата (Date);Түрі (Type);Сипаттама (Description);Сома (Amount);Валюта (Currency);Категория (Category);Жазба (Note)\n'
  for (const t of transactions) {
    const category = getTransactionCategory(t)
    const note = getTransactionNote(t)
    const row = [
      t.dateText,
      typeLabels[t.type] || t.type,
      `"${t.description.replace(/"/g, '""')}"`,
      t.amount,
      t.currency,
      `"${category}"`,
      `"${note.replace(/"/g, '""')}"`
    ]
    csv += row.join(';') + '\n'
  }

  // Append empty row and branding row at the end of CSV
  csv += '\n'
  csv += 'Жасалған құрал (Сгенерировано);;;;;;https://bank-analizer-beta.vercel.app/\n'

  // Prepend UTF-8 BOM string '\uFEFF' to force Excel on both Mac and Windows to parse Cyrillic correctly
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.setAttribute('download', `statement_export_${state.activeBank || 'unified'}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function exportExcel(transactions) {
  if (transactions.length === 0) return
  if (typeof XLSX === 'undefined') {
    alert('Excel оқу кітапханасы жүктелмеді. Сәл күте тұрыңыз.')
    return
  }

  const data = transactions.map(t => ({
    'Күні (Дата)': t.dateText,
    'Түрі (Тип)': typeLabels[t.type] || t.type,
    'Сипаттама (Описание)': t.description,
    'Сома (Сумма)': t.amount,
    'Валюта': t.currency,
    'Категория': getTransactionCategory(t),
    'Жазба (Заметка)': getTransactionNote(t) || ''
  }))

  const ws = XLSX.utils.json_to_sheet(data)
  
  // Add branding row to the sheet leaving a blank line after transaction rows
  // The transaction rows end at row index = data.length + 1 (including header)
  // We insert at data.length + 3 to leave one row blank
  XLSX.utils.sheet_add_aoa(ws, [
    ['Жасалған құрал (Сгенерировано):', 'https://bank-analizer-beta.vercel.app/']
  ], { origin: `A${data.length + 3}` })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Transactions")
  
  // Set automatic columns width
  ws['!cols'] = [
    { wch: 12 }, // Date
    { wch: 12 }, // Type
    { wch: 45 }, // Description
    { wch: 12 }, // Amount
    { wch: 8 },  // Currency
    { wch: 15 }, // Category
    { wch: 20 }  // Note
  ]

  XLSX.writeFile(wb, `statement_export_${state.activeBank || 'unified'}.xlsx`)
}

function exportWord(transactions) {
  if (transactions.length === 0) return
  
  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <title>Транзакциялар есебі</title>
      <style>
        body { font-family: 'Arial', sans-serif; color: #333333; }
        h1 { color: #007a5c; font-size: 20pt; text-align: center; margin-bottom: 5px; }
        p { font-size: 11pt; color: #555555; margin: 4px 0; }
        .meta-box { margin-bottom: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th { background-color: #f3f4f6; color: #374151; font-weight: bold; font-size: 10pt; border: 1px solid #d1d5db; padding: 8px; text-align: left; }
        td { border: 1px solid #e5e7eb; padding: 8px; font-size: 9.5pt; }
        .positive { color: #059669; font-weight: bold; }
        .negative { color: #dc2626; font-weight: bold; }
        .brand-footer { margin-top: 30px; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 15px; font-size: 10pt; color: #6b7280; }
      </style>
    </head>
    <body>
      <h1>Қаржылық транзакциялар есебі / Финансовый отчет</h1>
      <div class="meta-box">
        <p>Анализатор банкі (Банк выписки): <b>${state.activeBank ? BANKS[state.activeBank].name : 'Unified'}</b></p>
        <p>Транзакциялар саны (Количество транзакций): <b>${transactions.length}</b></p>
        <p>Есеп жасалған уақыт (Время генерации): <b>${new Date().toLocaleString()}</b></p>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Күні (Дата)</th>
            <th>Түрі (Тип)</th>
            <th>Сипаттама (Описание)</th>
            <th>Сома (Сумма)</th>
            <th>Категория (Категория)</th>
            <th>Жазба (Заметка)</th>
          </tr>
        </thead>
        <tbody>
  `
  
  for (const t of transactions) {
    const category = getTransactionCategory(t)
    const note = getTransactionNote(t)
    const amtClass = t.amount > 0 ? 'positive' : 'negative'
    const amtText = `${t.amount > 0 ? '+' : ''}${formatMoney(t.amount)} ${t.currency}`
    
    html += `
      <tr>
        <td>${t.dateText}</td>
        <td>${typeLabels[t.type] || t.type}</td>
        <td>${t.description}</td>
        <td class="${amtClass}">${amtText}</td>
        <td>${category}</td>
        <td>${note || '-'}</td>
      </tr>
    `
  }
  
  html += `
        </tbody>
      </table>
      <div class="brand-footer">
        Жасалған құрал (Сгенерировано): <a href="https://bank-analizer-beta.vercel.app/" style="color: #007a5c; text-decoration: none; font-weight: bold;">https://bank-analizer-beta.vercel.app/</a>
      </div>
    </body>
    </html>
  `
  
  // Prepend BOM to force Word to parse Cyrillic correctly
  const blob = new Blob(['\uFEFF' + html], { type: 'application/msword;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.setAttribute('download', `statement_report_${state.activeBank || 'unified'}.doc`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function exportPdf(transactions) {
  if (transactions.length === 0) return
  const stats = buildStats(transactions)
  
  const rows = transactions.map(t => `
    <tr>
      <td>${t.dateText}</td>
      <td>${typeLabels[t.type] || t.type}</td>
      <td>${t.description}</td>
      <td style="color: ${t.amount > 0 ? '#059669' : '#dc2626'}; font-weight: bold;">
        ${t.amount > 0 ? '+' : ''}${formatMoney(t.amount)} ${t.currency}
      </td>
      <td>${getTransactionCategory(t)}</td>
      <td>${getTransactionNote(t) || '-'}</td>
    </tr>
  `).join('')

  const printWindow = window.open('', '_blank')
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Транзакциялар есебі (PDF)</title>
        <style>
          body { font-family: 'Arial', sans-serif; background-color: #ffffff; padding: 20px; color: #1f2937; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e5e7eb; padding-bottom: 15px; }
          h1 { color: #111827; font-size: 22px; margin: 0 0 10px 0; }
          p { font-size: 13px; color: #4b5563; margin: 5px 0; }
          .stats-grid { display: flex; gap: 20px; justify-content: center; margin-bottom: 20px; }
          .stats-card { background: #f9fafb; border: 1px solid #e5e7eb; padding: 10px 20px; border-radius: 8px; text-align: center; }
          .stats-card strong { font-size: 16px; display: block; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
          th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
          th { background-color: #f3f4f6; color: #374151; font-weight: bold; }
          .positive { color: #059669; }
          .negative { color: #dc2626; }
          .brand-footer { margin-top: 40px; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 15px; font-size: 11px; color: #6b7280; }
          @media print {
            body { padding: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Қаржылық транзакциялар есебі / Финансовый отчет</h1>
          <p>Банк: <b>${state.activeBank ? BANKS[state.activeBank].name : 'Unified'}</b> · Шот/IBAN: <b>${state.account ? state.account.id : '-'}</b></p>
          <div class="stats-grid">
            <div class="stats-card">Кіріс (Доходы): <strong class="positive">+${formatMoney(stats.income)} ₸</strong></div>
            <div class="stats-card">Шығыс (Расходы): <strong class="negative">-${formatMoney(stats.expense)} ₸</strong></div>
            <div class="stats-card">Аударым (Переводы): <strong>${formatMoney(stats.transfers)} ₸</strong></div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Күні (Дата)</th>
              <th>Түрі (Тип)</th>
              <th>Сипаттама (Описание)</th>
              <th>Сома (Сумма)</th>
              <th>Категория (Категория)</th>
              <th>Жазба (Заметка)</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="brand-footer">
          Жасалған құрал (Сгенерировано): <b>https://bank-analizer-beta.vercel.app/</b>
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          }
        </script>
      </body>
    </html>
  `)
  printWindow.document.close()
}

function exportJson(transactions) {
  if (transactions.length === 0) return
  const data = transactions.map(t => ({
    date: t.dateText,
    time: t.time,
    type: t.type,
    typeLabel: typeLabels[t.type] || t.type,
    description: t.description,
    amount: t.amount,
    currency: t.currency,
    category: getTransactionCategory(t),
    note: getTransactionNote(t)
  }))

  const payload = {
    transactions: data,
    metadata: {
      generatedBy: "https://bank-analizer-beta.vercel.app/",
      exportedAt: new Date().toISOString(),
      bank: state.activeBank ? BANKS[state.activeBank].name : 'Unified'
    }
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.setAttribute('download', `statement_export_${state.activeBank || 'unified'}.json`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function exportHtmlReport() {
  if (state.filtered.length === 0) return
  const stats = buildStats(state.filtered)
  const rows = state.filtered.map(t => `
    <tr>
      <td>${t.dateText}</td>
      <td>${typeLabels[t.type] || t.type}</td>
      <td>${t.description}</td>
      <td style="color: ${t.amount > 0 ? '#10B981' : '#EF4444'}; font-weight: bold;">${formatMoney(t.amount)}</td>
      <td>${getTransactionCategory(t)}</td>
    </tr>
  `).join('')

  const report = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Financial Report</title>
        <style>
          body { font-family: sans-serif; background-color: #F9FAFB; padding: 40px; color: #111827; }
          .container { max-width: 900px; margin: 0 auto; background: white; padding: 32px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
          h1 { margin-bottom: 8px; font-size: 24px; }
          table { width: 100%; border-collapse: collapse; margin-top: 24px; }
          th, td { text-align: left; padding: 12px; border-bottom: 1px solid #E5E7EB; }
          th { background-color: #F3F4F6; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Қаржылық есеп беру</h1>
          <p>Кіріс: <strong>${formatMoney(stats.income)}</strong> · Шығыс: <strong>${formatMoney(stats.expense)}</strong></p>
          <table>
            <thead><tr><th>Дата</th><th>Түрі</th><th>Сипаттама</th><th>Сома</th><th>Санат</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </body>
    </html>
  `

  const blob = new Blob([report], { type: 'text/html' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.setAttribute('download', `statement_report_${state.activeBank || 'unified'}.html`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
