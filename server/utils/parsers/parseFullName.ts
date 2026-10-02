// https://github.com/RateGravity/parse-full-name/blob/master/index.js

type ParsedName = {
  title: string
  first: string
  middle: string
  last: string
  nick: string
  suffix: string
  error: string[]
}

const namePartKeys = ['title', 'first', 'middle', 'last', 'nick', 'suffix', 'error'] as const
type NamePart = (typeof namePartKeys)[number]

const parseFullName = (nameToParse: unknown, partToReturn?: unknown, fixCase?: unknown, stopOnError?: unknown, useLongLists?: unknown): ParsedName | ParsedName[NamePart] => {
  let i = 0
  let j = 0
  let l = 0
  let m = 0
  let n: string[] = []
  let part = ''
  let comma: string | null = null
  let suffixList!: string[]
  let prefixList!: string[]
  let titleList!: string[]
  let regex: RegExp
  let partToCheck = ''
  let partsFoundCount = 0
  let firstComma = 0
  let remainingCommas = 0
  const nameParts: string[] = []
  const nameCommas: Array<string | null> = [null]
  let partsFound: string[] = []
  const conjunctionList = ['&', 'and', 'et', 'e', 'of', 'the', 'und', 'y']
  let parsedName: ParsedName = {
    title: '',
    first: '',
    middle: '',
    last: '',
    nick: '',
    suffix: '',
    error: []
  }

  let partKey: NamePart | 'all' = 'all'
  if (partToReturn) {
    const requested = (partToReturn as { toLowerCase(): string }).toLowerCase()
    if ((namePartKeys as readonly string[]).indexOf(requested) > -1) {
      partKey = requested as NamePart
    }
  }
  // 'all' = return object with all parts, others return single part

  let fixCaseFlag = fixCase as boolean | number | string | undefined
  if (fixCaseFlag === false) fixCaseFlag = 0
  if (fixCaseFlag === true) fixCaseFlag = 1
  fixCaseFlag = fixCaseFlag !== 'undefined' && (fixCaseFlag === 0 || fixCaseFlag === 1) ? fixCaseFlag : -1 // -1 = fix case only if input is all upper or lowercase

  let stopOnErrorFlag = stopOnError as boolean | number | undefined
  if (stopOnErrorFlag === true) stopOnErrorFlag = 1
  stopOnErrorFlag = stopOnErrorFlag && stopOnErrorFlag === 1 ? 1 : 0
  // false = output warnings on parse error, but don't stop

  let useLongListsFlag = useLongLists as boolean | number | undefined
  if (useLongListsFlag === true) useLongListsFlag = 1
  useLongListsFlag = useLongListsFlag && useLongListsFlag === 1 ? 1 : 0 // 0 = short lists

  const returnPart = (): ParsedName | ParsedName[NamePart] => (partKey === 'all' ? parsedName : parsedName[partKey])

  // If stopOnError = 1, throw error, otherwise return error messages in array
  function handleError(errorMessage: string) {
    if (stopOnErrorFlag) {
      // The original function throws this string. Catch sites compare it as a string.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw 'Error: ' + errorMessage
    } else {
      parsedName.error.push('Error: ' + errorMessage)
    }
  }

  // If fixCase = 1, fix case of parsedName parts before returning
  function fixParsedNameCase(fixedCaseName: ParsedName, fixCaseNow: number): ParsedName {
    const forceCaseList = [
      'e',
      'y',
      'av',
      'af',
      'da',
      'dal',
      'de',
      'del',
      'der',
      'di',
      'la',
      'le',
      'van',
      'der',
      'den',
      'vel',
      'von',
      'II',
      'III',
      'IV',
      'J.D.',
      'LL.M.',
      'M.D.',
      'D.O.',
      'D.C.',
      'Ph.D.'
    ]
    let forceCaseListIndex: number
    let namePartLabels: string[] = []
    let namePartWords: string[]
    if (fixCaseNow) {
      namePartLabels = Object.keys(parsedName).filter(function (v) {
        return v !== 'error'
      })
      for (i = 0, l = namePartLabels.length; i < l; i++) {
        const label = namePartLabels[i] as Exclude<keyof ParsedName, 'error'>
        if (fixedCaseName[label]) {
          namePartWords = (fixedCaseName[label] + '').split(' ')
          for (j = 0, m = namePartWords.length; j < m; j++) {
            forceCaseListIndex = forceCaseList
              .map(function (v) {
                return v.toLowerCase()
              })
              .indexOf(namePartWords[j].toLowerCase())
            if (forceCaseListIndex > -1) {
              // Set case of words in forceCaseList
              namePartWords[j] = forceCaseList[forceCaseListIndex]
            } else if (namePartWords[j].length === 1) {
              // Uppercase initials
              namePartWords[j] = namePartWords[j].toUpperCase()
            } else if (
              namePartWords[j].length > 2 &&
              namePartWords[j].slice(0, 1) === namePartWords[j].slice(0, 1).toUpperCase() &&
              namePartWords[j].slice(1, 2) === namePartWords[j].slice(1, 2).toLowerCase() &&
              namePartWords[j].slice(2) === namePartWords[j].slice(2).toUpperCase()
            ) {
              // Detect McCASE and convert to McCase
              namePartWords[j] = namePartWords[j].slice(0, 3) + namePartWords[j].slice(3).toLowerCase()
            } else if (namePartLabels[j] === 'suffix' && namePartWords[j].slice(-1) !== '.' && !suffixList.indexOf(namePartWords[j].toLowerCase())) {
              // Convert suffix abbreviations to UPPER CASE
              if (namePartWords[j] === namePartWords[j].toLowerCase()) {
                namePartWords[j] = namePartWords[j].toUpperCase()
              }
            } else {
              // Convert to Title Case
              namePartWords[j] = namePartWords[j].slice(0, 1).toUpperCase() + namePartWords[j].slice(1).toLowerCase()
            }
          }
          fixedCaseName[label] = namePartWords.join(' ')
        }
      }
    }
    return fixedCaseName
  }

  // If no input name, or input name is not a string, abort
  let nameText: string
  if (!nameToParse || typeof nameToParse !== 'string') {
    handleError('No input')
    parsedName = fixParsedNameCase(parsedName, fixCaseFlag)
    return returnPart()
  } else {
    nameText = nameToParse.trim()
  }

  // Auto-detect fixCase: fix if nameToParse is all upper or all lowercase
  if (fixCaseFlag === -1) {
    fixCaseFlag = nameText === nameText.toUpperCase() || nameText === nameText.toLowerCase() ? 1 : 0
  }

  // Initilize lists of prefixs, suffixs, and titles to detect
  // Note: These list entries must be all lowercase
  if (useLongListsFlag) {
    suffixList = ['esq', 'esquire', 'jr', 'jnr', 'sr', 'snr', '2', 'ii', 'iii', 'iv', 'v', 'clu', 'chfc', 'cfp', 'md', 'phd', 'j.d.', 'll.m.', 'm.d.', 'd.o.', 'd.c.', 'p.c.', 'ph.d.']
    prefixList = [
      'a',
      'ab',
      'antune',
      'ap',
      'abu',
      'al',
      'alm',
      'alt',
      'bab',
      'bäck',
      'bar',
      'bath',
      'bat',
      'beau',
      'beck',
      'ben',
      'berg',
      'bet',
      'bin',
      'bint',
      'birch',
      'björk',
      'björn',
      'bjur',
      'da',
      'dahl',
      'dal',
      'de',
      'degli',
      'dele',
      'del',
      'della',
      'der',
      'di',
      'dos',
      'du',
      'e',
      'ek',
      'el',
      'escob',
      'esch',
      'fleisch',
      'fitz',
      'fors',
      'gott',
      'griff',
      'haj',
      'haug',
      'holm',
      'ibn',
      'kauf',
      'kil',
      'koop',
      'kvarn',
      'la',
      'le',
      'lind',
      'lönn',
      'lund',
      'mac',
      'mhic',
      'mic',
      'mir',
      'na',
      'naka',
      'neder',
      'nic',
      'ni',
      'nin',
      'nord',
      'norr',
      'ny',
      'o',
      'ua',
      "ui'",
      'öfver',
      'ost',
      'över',
      'öz',
      'papa',
      'pour',
      'quarn',
      'skog',
      'skoog',
      'sten',
      'stor',
      'ström',
      'söder',
      'ter',
      'ter',
      'tre',
      'türk',
      'van',
      'väst',
      'väster',
      'vest',
      'von'
    ]
    titleList = [
      'mr',
      'mrs',
      'ms',
      'miss',
      'dr',
      'herr',
      'monsieur',
      'hr',
      'frau',
      'a v m',
      'admiraal',
      'admiral',
      'air cdre',
      'air commodore',
      'air marshal',
      'air vice marshal',
      'alderman',
      'alhaji',
      'ambassador',
      'baron',
      'barones',
      'brig',
      'brig gen',
      'brig general',
      'brigadier',
      'brigadier general',
      'brother',
      'canon',
      'capt',
      'captain',
      'cardinal',
      'cdr',
      'chief',
      'cik',
      'cmdr',
      'coach',
      'col',
      'col dr',
      'colonel',
      'commandant',
      'commander',
      'commissioner',
      'commodore',
      'comte',
      'comtessa',
      'congressman',
      'conseiller',
      'consul',
      'conte',
      'contessa',
      'corporal',
      'councillor',
      'count',
      'countess',
      'crown prince',
      'crown princess',
      'dame',
      'datin',
      'dato',
      'datuk',
      'datuk seri',
      'deacon',
      'deaconess',
      'dean',
      'dhr',
      'dipl ing',
      'doctor',
      'dott',
      'dott sa',
      'dr',
      'dr ing',
      'dra',
      'drs',
      'embajador',
      'embajadora',
      'en',
      'encik',
      'eng',
      'eur ing',
      'exma sra',
      'exmo sr',
      'f o',
      'father',
      'first lieutient',
      'first officer',
      'flt lieut',
      'flying officer',
      'fr',
      'frau',
      'fraulein',
      'fru',
      'gen',
      'generaal',
      'general',
      'governor',
      'graaf',
      'gravin',
      'group captain',
      'grp capt',
      'h e dr',
      'h h',
      'h m',
      'h r h',
      'hajah',
      'haji',
      'hajim',
      'her highness',
      'her majesty',
      'herr',
      'high chief',
      'his highness',
      'his holiness',
      'his majesty',
      'hon',
      'hr',
      'hra',
      'ing',
      'ir',
      'jonkheer',
      'judge',
      'justice',
      'khun ying',
      'kolonel',
      'lady',
      'lcda',
      'lic',
      'lieut',
      'lieut cdr',
      'lieut col',
      'lieut gen',
      'lord',
      'm',
      'm l',
      'm r',
      'madame',
      'mademoiselle',
      'maj gen',
      'major',
      'master',
      'mevrouw',
      'miss',
      'mlle',
      'mme',
      'monsieur',
      'monsignor',
      'mr',
      'mrs',
      'ms',
      'mstr',
      'nti',
      'pastor',
      'president',
      'prince',
      'princess',
      'princesse',
      'prinses',
      'prof',
      'prof dr',
      'prof sir',
      'professor',
      'puan',
      'puan sri',
      'rabbi',
      'rear admiral',
      'rev',
      'rev canon',
      'rev dr',
      'rev mother',
      'reverend',
      'rva',
      'senator',
      'sergeant',
      'sheikh',
      'sheikha',
      'sig',
      'sig na',
      'sig ra',
      'sir',
      'sister',
      'sqn ldr',
      'sr',
      'sr d',
      'sra',
      'srta',
      'sultan',
      'tan sri',
      'tan sri dato',
      'tengku',
      'teuku',
      'than puying',
      'the hon dr',
      'the hon justice',
      'the hon miss',
      'the hon mr',
      'the hon mrs',
      'the hon ms',
      'the hon sir',
      'the very rev',
      'toh puan',
      'tun',
      'vice admiral',
      'viscount',
      'viscountess',
      'wg cdr',
      'ind',
      'misc',
      'mx'
    ]
  } else {
    suffixList = ['esq', 'esquire', 'jr', 'jnr', 'sr', 'snr', '2', 'ii', 'iii', 'iv', 'md', 'phd', 'j.d.', 'll.m.', 'm.d.', 'd.o.', 'd.c.', 'p.c.', 'ph.d.']
    prefixList = ['ab', 'bar', 'bin', 'da', 'dal', 'de', 'de la', 'del', 'della', 'der', 'di', 'du', 'ibn', "l'", 'la', 'le', 'san', 'st', 'st.', 'ste', 'ter', 'van', 'van de', 'van der', 'van den', 'vel', 'ver', 'vere', 'von']
    titleList = ['dr', 'miss', 'mr', 'mrs', 'ms', 'prof', 'sir', 'frau', 'herr', 'hr', 'monsieur', 'captain', 'doctor', 'judge', 'officer', 'professor', 'ind', 'misc', 'mx']
  }

  // Nickname: remove and store parts with surrounding punctuation as nicknames
  regex = /\s(?:[‘’']([^‘’']+)[‘’']|[“”"]([^“”"]+)[“”"]|\[([^\]]+)\]|\(([^\)]+)\)),?\s/g
  const partFound = (' ' + nameText + ' ').match(regex)
  if (partFound) partsFound = partsFound.concat(partFound)
  partsFoundCount = partsFound.length
  if (partsFoundCount === 1) {
    parsedName.nick = partsFound[0].slice(2).slice(0, -2)
    if (parsedName.nick.slice(-1) === ',') {
      parsedName.nick = parsedName.nick.slice(0, -1)
    }
    nameText = (' ' + nameText + ' ').replace(partsFound[0], ' ').trim()
    partsFound = []
  } else if (partsFoundCount > 1) {
    handleError(partsFoundCount + ' nicknames found')
    for (i = 0; i < partsFoundCount; i++) {
      nameText = (' ' + nameText + ' ').replace(partsFound[i], ' ').trim()
      partsFound[i] = partsFound[i].slice(2).slice(0, -2)
      if (partsFound[i].slice(-1) === ',') {
        partsFound[i] = partsFound[i].slice(0, -1)
      }
    }
    parsedName.nick = partsFound.join(', ')
    partsFound = []
  }
  if (!nameText.trim().length) {
    parsedName = fixParsedNameCase(parsedName, fixCaseFlag)
    return returnPart()
  }

  // Split remaining nameToParse into parts, remove and store preceding commas
  for (i = 0, n = nameText.split(' '), l = n.length; i < l; i++) {
    part = n[i]
    comma = null
    if (part.slice(-1) === ',') {
      comma = ','
      part = part.slice(0, -1)
    }
    nameParts.push(part)
    nameCommas.push(comma)
  }

  // Suffix: remove and store matching parts as suffixes
  for (l = nameParts.length, i = l - 1; i > 0; i--) {
    partToCheck = nameParts[i].slice(-1) === '.' ? nameParts[i].slice(0, -1).toLowerCase() : nameParts[i].toLowerCase()
    if (suffixList.indexOf(partToCheck) > -1 || suffixList.indexOf(partToCheck + '.') > -1) {
      partsFound = nameParts.splice(i, 1).concat(partsFound)
      if (nameCommas[i] === ',') {
        // Keep comma, either before or after
        nameCommas.splice(i + 1, 1)
      } else {
        nameCommas.splice(i, 1)
      }
    }
  }
  partsFoundCount = partsFound.length
  if (partsFoundCount === 1) {
    parsedName.suffix = partsFound[0]
    partsFound = []
  } else if (partsFoundCount > 1) {
    handleError(partsFoundCount + ' suffixes found')
    parsedName.suffix = partsFound.join(', ')
    partsFound = []
  }
  if (!nameParts.length) {
    parsedName = fixParsedNameCase(parsedName, fixCaseFlag)
    return returnPart()
  }

  // Title: remove and store matching parts as titles
  for (l = nameParts.length, i = l - 1; i >= 0; i--) {
    partToCheck = nameParts[i].slice(-1) === '.' ? nameParts[i].slice(0, -1).toLowerCase() : nameParts[i].toLowerCase()
    if (titleList.indexOf(partToCheck) > -1 || titleList.indexOf(partToCheck + '.') > -1) {
      partsFound = nameParts.splice(i, 1).concat(partsFound)
      if (nameCommas[i] === ',') {
        // Keep comma, either before or after
        nameCommas.splice(i + 1, 1)
      } else {
        nameCommas.splice(i, 1)
      }
    }
  }
  partsFoundCount = partsFound.length
  if (partsFoundCount === 1) {
    parsedName.title = partsFound[0]
    partsFound = []
  } else if (partsFoundCount > 1) {
    handleError(partsFoundCount + ' titles found')
    parsedName.title = partsFound.join(', ')
    partsFound = []
  }
  if (!nameParts.length) {
    parsedName = fixParsedNameCase(parsedName, fixCaseFlag)
    return returnPart()
  }

  // Join name prefixes to following names
  if (nameParts.length > 1) {
    for (i = nameParts.length - 2; i >= 0; i--) {
      if (prefixList.indexOf(nameParts[i].toLowerCase()) > -1) {
        nameParts[i] = nameParts[i] + ' ' + nameParts[i + 1]
        nameParts.splice(i + 1, 1)
        nameCommas.splice(i + 1, 1)
      }
    }
  }

  // Join conjunctions to surrounding names
  if (nameParts.length > 2) {
    for (i = nameParts.length - 3; i >= 0; i--) {
      if (conjunctionList.indexOf(nameParts[i + 1].toLowerCase()) > -1) {
        nameParts[i] = nameParts[i] + ' ' + nameParts[i + 1] + ' ' + nameParts[i + 2]
        nameParts.splice(i + 1, 2)
        nameCommas.splice(i + 1, 2)
        i--
      }
    }
  }

  // Suffix: remove and store items after extra commas as suffixes
  nameCommas.pop()
  firstComma = nameCommas.indexOf(',')
  remainingCommas = nameCommas.filter(function (v) {
    return v !== null
  }).length
  if (firstComma > 1 || remainingCommas > 1) {
    for (i = nameParts.length - 1; i >= 2; i--) {
      if (nameCommas[i] === ',') {
        partsFound = nameParts.splice(i, 1).concat(partsFound)
        nameCommas.splice(i, 1)
        remainingCommas--
      } else {
        break
      }
    }
  }
  if (partsFound.length) {
    if (parsedName.suffix) {
      partsFound = [parsedName.suffix].concat(partsFound)
    }
    parsedName.suffix = partsFound.join(', ')
    partsFound = []
  }

  // Last name: remove and store last name
  if (remainingCommas > 0) {
    if (remainingCommas > 1) {
      handleError(remainingCommas - 1 + ' extra commas found')
    }
    // Remove and store all parts before first comma as last name
    if (nameCommas.indexOf(',')) {
      parsedName.last = nameParts.splice(0, nameCommas.indexOf(',')).join(' ')
      nameCommas.splice(0, nameCommas.indexOf(','))
    }
  } else {
    // Remove and store last part as last name
    parsedName.last = nameParts.pop() as string
  }
  if (!nameParts.length) {
    parsedName = fixParsedNameCase(parsedName, fixCaseFlag)
    return returnPart()
  }

  // First name: remove and store first part as first name
  parsedName.first = nameParts.shift() as string
  if (!nameParts.length) {
    parsedName = fixParsedNameCase(parsedName, fixCaseFlag)
    return returnPart()
  }

  // Middle name: store all remaining parts as middle name
  if (nameParts.length > 2) {
    handleError(nameParts.length + ' middle names')
  }
  parsedName.middle = nameParts.join(' ')

  parsedName = fixParsedNameCase(parsedName, fixCaseFlag)
  return returnPart()
}

export = parseFullName
