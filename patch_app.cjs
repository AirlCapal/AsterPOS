const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');

// 1. Remove CustomizationModal definition
content = content.replace(/\/\/ --- Customization Modal ---\nconst CustomizationModal = \(\{[\s\S]*?^\};\n/m, '');

// 2. Remove CustomizationModal usage
content = content.replace(/<CustomizationModal isOpen=\{!!customizationProduct\}[\s\S]*?\/>\n/g, '');

// 3. Update Payment Modal item name
content = content.replace(/\{item\.quantity\}x \{item\.product\.name\} \{item\.modifications\?\.size && `\(\$\{item\.modifications\.size\.split\(' '\)\[0\]\}\)`\}/g, '{item.quantity}x {item.product.name}');

// 4. Remove customizationProduct state
content = content.replace(/ *const \[customizationProduct, setCustomizationProduct\] = useState\(null\);\n/g, '');

// 5. Update handleAddToCart and executeQuantityUpdate
const oldCartFunctions = `  const handleAddToCart = (productWithMods) => {
    setCart(prev => {
      const modString = JSON.stringify(productWithMods.modifications);
      const existing = prev.find(item => item.product.id === productWithMods.product.id && JSON.stringify(item.modifications) === modString);
      if (existing) {
        return prev.map(item => (item.product.id === productWithMods.product.id && JSON.stringify(item.modifications) === modString)
          ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...productWithMods, quantity: 1 }];
    });
  };

  const executeQuantityUpdate = (productObj, delta) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productObj.product.id && JSON.stringify(item.modifications) === JSON.stringify(productObj.modifications)) {
        return { ...item, quantity: item.quantity + delta };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };`;

const newCartFunctions = `  const handleAddToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => (item.product.id === product.id)
          ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const executeQuantityUpdate = (productObj, delta) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productObj.product.id) {
        return { ...item, quantity: item.quantity + delta };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };`;

content = content.replace(oldCartFunctions, newCartFunctions);

// 6. Update handleCheckout save logic
content = content.replace(/items: cart\.map\(item => \(\{ productId: item\.product\.id, quantity: item\.quantity, modifications: item\.modifications \}\)\)/g, 'items: cart.map(item => ({ productId: item.product.id, quantity: item.quantity }))');

// 7. Product click mapping
const oldClick = `                <button key={product.id} onClick={() => {
                  if (product.options && product.options.length > 0) {
                    setCustomizationProduct(product);
                  } else {
                    handleAddToCart({ product, modifications: {} });
                  }
                }}`;
const newClick = `                <button key={product.id} onClick={() => {
                  handleAddToCart(product);
                }}`;
content = content.replace(oldClick, newClick);

// 8. Desktop cart render modifications block
const modBlockRegex = / *\{item\.modifications && Object\.keys\(item\.modifications\)\.length > 0 && \([\s\S]*?\}\)\n *\}\)\}\n *<\/div>\n *\)\}\n/g;
content = content.replace(modBlockRegex, '');

fs.writeFileSync('src/App.jsx', content, 'utf8');
console.log('App.jsx patched successfully');
