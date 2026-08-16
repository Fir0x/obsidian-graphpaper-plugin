# Graphpaper

Graphpaper is a an Obsidian plugin to display interactive math plots in notes.

This plugin aims for an easy and readable way to describe your plot.

## How to use?

Simply add a code block with the `graphpaper` specifier.

The language used for plot configuration is YAML. All fields are required:

- `xMin`: Minimum x value for the function.
- `xMax`: Maximum x value for the function.
- `sampleCount`: Number of samples taken along the curve. In reality, one more
sample is taken in order to reach `xMax`.
- `function`: The math function to plot.

Example:

```graphpaper
xMin: -10
xMax: 10
sampleCount: 100
function: x^2
```

## FAQ

### What is used to create the plot?

Graphpaper is powered by [Plotly.js](https://github.com/plotly/plotly.js/).

### Was any LLM involved with this project?

I am new to Typescript, so Claude was used to complement to the official
documentations and forums to learn the language and best practices.

However, this project was not vibecoded in any way as I stand against that.
