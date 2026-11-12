type OptionDefinition = {
  readonly name: string
  readonly alias: string
  readonly type: StringConstructor | BooleanConstructor
}

declare function commandLineArgs<const Options extends readonly OptionDefinition[]>(
  definitions: Options
): { [Option in Options[number] as Option['name']]?: ReturnType<Option['type']> }

export = commandLineArgs
