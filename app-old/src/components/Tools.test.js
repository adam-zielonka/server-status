import { getHumanSize, getHumanTime } from './Tools'

describe('getHumanSize()', () => {
  const compare = {
    'ala': '0 B',
    0: '0 B',
    1: '1 B',
    1024: '1 KB',
    1048576: '1 MB',
    1073741824: '1 GB',
    1099511627776: '1 TB',
    1125899906842624: '1 PB',
    1152921504606847000: '1 EB',
    1.1805916207174113e+21: '1 ZB',
    1.2089258196146292e+24: '1 YB',
    1.2379400392853803e+27: '1024 YB',
    1023: '1023 B',
    1047552: '1023 KB',
    1072693248: '1023 MB',
    1098437885952: '1023 GB',
    1124800395214848: '1023 TB',
    1151795604700004400: '1023 PB',
    1.1794386992128045e+21: '1023 EB',
    1.2077452279939118e+24: '1023 ZB',
    1.2367311134657656e+27: '1023 YB',
    1.239148965104995e+27: '1025 YB',
    1110556602: '1.03 GB',
    174669820: '166.58 MB',
  }

  const escape = str => str.replace(' ', '\u00A0')

  ;['', undefined, null, [1,2,3]].map(input => {
    it(`${input} => 0 B`, () => expect(getHumanSize(input)).toBe(escape('0 B')))
  })

  Object.entries(compare).map(([input, output]) => {
    it(`${input} => ${output}`, () => expect(getHumanSize(input)).toBe(escape(output)))
  })
})

describe('getHumanTime()', () => {
  const compare = {
    0: '',
    1: '1 second',
    60: '1 minute',
    3600: '1 hour',
    86400: '1 day',
    31536000: '1 year',
    2006605937: '63 years 229 days 14 hours 32 minutes 17 seconds',
    2006605: '23 days 5 hours 23 minutes 25 seconds',
    6577179: '76 days 2 hours 59 minutes 39 seconds',
    'ala': ''
  }

  ;['', undefined, null, [1,2,3]].map(input => {
    it(`${input} => 0 B`, () => expect(getHumanTime(input)).toBe(''))
  })
  
  Object.entries(compare).map(([input, output]) => {
    it(`${input} => ${output}`, () => expect(getHumanTime(input, 5)).toBe(output))
  })
})
