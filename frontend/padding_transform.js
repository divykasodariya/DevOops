module.exports = function(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  root.find(j.CallExpression, { callee: { property: { name: 'create' }, object: { name: 'StyleSheet' } } })
    .forEach(path => {
      j(path).find(j.ObjectProperty).forEach(propPath => {
         const keyName = propPath.node.key.name;
         // only target common top-level structural containers
         if (['safe', 'safeArea', 'scroll', 'content', 'header'].includes(keyName)) {
           j(propPath).find(j.ObjectProperty, { key: { name: 'paddingTop' } })
             .forEach(ptPath => {
                // If it's safe or safeArea, since SafeAreaView natively gives top inset padding, we want padding to be minimal or 0.
                if (['safe', 'safeArea'].includes(keyName)) {
                   ptPath.node.value = j.literal(0);
                } else {
                   // For scroll or header or content inside SafeAreaView, maybe just 10.
                   ptPath.node.value = j.literal(10);
                }
             });
         }
      });
    });

  return root.toSource();
};
module.exports.parser = 'babel';
