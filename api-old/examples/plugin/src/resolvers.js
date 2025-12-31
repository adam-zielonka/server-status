const getArray = () => ([])
const getValue = name => name

export const SomePlugin = {
  important: () => 'YES',
  name: () => 'My name',
  code: () => '42',
  array: () => getArray()
}

export const MyArray = {
  value: ({ name }) => getValue(name),
}
