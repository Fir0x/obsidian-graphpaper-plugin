# Graphpaper

Graphpaper is an Obsidian plugin to display interactive math plots in notes.

This plugin aims for an easy and readable way to describe your plot.

## How to use?

### Basic usage

Simply add a code block with the `graphpaper` specifier.

The language used for plot configuration is YAML. All these fields are required:

- `xMin`: Minimum x value for the function.
- `xMax`: Maximum x value for the function.
- `sampleCount`: Number of samples taken along the curve. In reality, one more
sample is taken in order to reach `xMax`.
- `functions`: The math functions to plot.

If you wan to define multiple functions, `functions` must be a list.
Each element must have a `name` and a `def` fields.

If you want to define only one function, you can just write it as the value of `functions`.

Examples:

- One function

```graphpaper
xMin: -10
xMax: 10
sampleCount: 1000
functions: x^2
```

- Multiple functions

```graphpaper
xMin: -10
xMax: 10
sampleCount: 1000
functions:
  - name: f
    def: cos(x)
  - name: g
    def: sin(x)
```

See the [wiki](https://github.com/Fir0x/obsidian-graphpaper-plugin/wiki/Usage) for more.

## FAQ

### What is used to create the plot?

Graphpaper is powered by [Plotly.js](https://github.com/plotly/plotly.js/).

### Was any LLM involved with this project?

I am new to Typescript, so Claude was used to complement to the official
documentations and forums to learn the language and best practices.

However, this project was not vibecoded in any way as I stand against that.
