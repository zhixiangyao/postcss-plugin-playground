# css-modules-scope

## compose & compose-with

```css
.foo {
  color: red;
}
.bar:hover {
  composes: foo;
}
```

```css
.foo {
  color: red;
}
.bar:hover {
  color: red;
}
```