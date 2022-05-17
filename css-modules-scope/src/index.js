import selectorParser from 'postcss-selector-parser'

/**
 *
 * @param {string} name
 * @returns {string}
 */
const generateScopedName = name => {
  const randomStr = Math.random().toString(16).slice(2)
  return `_${randomStr}__${name}`
}

const plugin = () => {
  return {
    postcssPlugin: 'my-postcss-modules-scope',
    Once(root, helpers) {
      const exports = {}

      /**
       *
       * @param {string} name
       * @returns {string}
       */
      const exportScopedName = name => {
        const scopedName = generateScopedName(name)

        exports[name] = exports[name] || []

        if (exports[name].indexOf(scopedName) < 0) {
          exports[name].push(scopedName)
        }

        return scopedName
      }

      const localizeNode = node => {
        switch (node.type) {
          case 'selector':
            node.nodes = node.map(localizeNode)
            return node
          case 'class':
            return selectorParser.className({
              value: exportScopedName(node.value, node.raws && node.raws.value ? node.raws.value : null),
            })
          case 'id': {
            return selectorParser.id({
              value: exportScopedName(node.value, node.raws && node.raws.value ? node.raws.value : null),
            })
          }
        }
      }

      const traverseNode = node => {
        switch (node.type) {
          case 'root':
          case 'selector': {
            node.each(traverseNode)
            break
          }
          case 'id':
          case 'class':
            exports[node.value] = [node.value]
            break
          case 'pseudo':
            if (node.value === ':local') {
              const selector = localizeNode(node.first)

              node.replaceWith(selector)

              return
            }
        }
        return node
      }

      // 处理 :local 选择器
      root.walkRules(rule => {
        const parsedSelector = selectorParser().astSync(rule)

        const oldSelectorNode = parsedSelector.clone()
        const newSelectorNode = traverseNode(oldSelectorNode)

        rule.selector = newSelectorNode.toString()

        rule.walkDecls(/composes|compose-with/i, decl => {
          const localNames = parsedSelector.nodes.map(node => {
            return node.nodes[0].first.first.value
          })

          // dong
          // dongdong
          const classes = decl.value.split(/\s+/)

          classes.forEach(className => {
            const global = /^global\(([^)]+)\)$/.exec(className)

            if (global) {
              localNames.forEach(exportedName => {
                exports[exportedName].push(global[1])
              })
            } else if (Object.prototype.hasOwnProperty.call(exports, className)) {
              localNames.forEach(exportedName => {
                exports[className].forEach(item => {
                  exports[exportedName].push(item)
                })
              })
            } else {
              throw decl.error(`referenced class name "${className}" in ${decl.prop} not found`)
            }
          })

          // Delete the original "composes" or "compose-with" declaration
          decl.remove()
        })
      })

      // 处理 :local keyframes
      root.walkAtRules(/keyframes$/i, atRule => {
        const localMatch = /^:local\((.*)\)$/.exec(atRule.params)

        if (localMatch) {
          atRule.params = exportScopedName(localMatch[1])
        }
      })

      // 生成 :export rule
      const exportedNames = Object.keys(exports)

      if (exportedNames.length > 0) {
        const exportRule = helpers.rule({ selector: ':export' })

        exportedNames.forEach(exportedName =>
          exportRule.append({
            prop: exportedName,
            value: exports[exportedName].join(' '),
            raws: { before: '\n  ' },
          })
        )

        root.append(exportRule)
      }
    },
  }
}

plugin.postcss = true

export default plugin
