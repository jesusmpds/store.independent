const emptyCartBody = data => {
  // Need an empty cart to start with.
  return {
    _embedded: {
      "fx:attributes": data.attributes,
      "fx:items": data.items,
      "fx:applied_coupon_codes": data.coupons,
    },
    customer_uri: null,
    template_set_uri: null,
    language: null,
    locale_code: null,
    total_item_price: null,
    total_tax: null,
    total_shipping: null,
    total_future_shipping: null,
    total_order: null,
  };
};

const emptyItemBody = data => {
  // Need an empty cart to start with.
  data.item_category_uri =
    data.item_category_uri || `https://api.foxycart.com/item_categories/${data.category_id}`;

  return {
    item_category_uri: data.item_category_uri,
    name: data.name,
    price: data.price,
    quantity: data.quantity || 1,
    quantity_min: data.quantity_min || 0,
    quantity_max: data.quantity_max || 0,
    weight: data.weight || "",
    code: data.item,
    parent_code: data.parent_code || "",
    discount_name: data.discount_name || "",
    discount_type: data.discount_type || "",
    discount_details: data.discount_details || "",
    subscription_frequency: data.subscription_frequency || "",
    subscription_start_date: data.subscription_start_date || "",
    subscription_next_transaction_date: data.subscription_next_transaction_date || null,
    subscription_end_date: data.subscription_end_date || null,
    is_future_line_item: false,
    shipto: data.shipto || "",
    url: data.url || "",
    image: data.image || "",
    length: data.length || 0,
    width: data.width || 0,
    height: data.height || 0,
    expires: data.expires || 0,
    _embedded: {},
  };
};

const createItemFromSkeleton = p => {
  console.log(JSON.stringify(p));

  const item = emptyItemBody({
    category_id: d.category_id,
    name: d.name,
    price: d.price,
    quantity: d.quantity,
    quantity_min: d.quantity_min,
    quantity_max: d.quantity_max,
    weight: d.weight,
    code: d.code,
    parent_code: d.parent_code,
    discount_name: d.discount_name,
    discount_type: d.discount_type,
    discount_details: d.discount_details,
    subscription_frequency: d.subscription_frequency,
    subscription_start_date: d.subscription_start_date,
    subscription_end_date: d.subscription_end_date,
    shipto: d.shipto,
    url: d.url,
    image: d.image,
    length: d.length,
    width: d.width,
    height: d.height,
    expires: d.expires,
  });
  item._embedded["fx:item_options"] = [...d.options];
  return item;
};

const calculatePrice = (regularPrice, listPrice, quantity, discountDefinition) => {
  let price = regularPrice; // Start with regular price, fallback to list price if regular price is not provided

  // Check if discount definition exists and if quantity meets the criteria
  if (discountDefinition) {
    // Extract discount percentages and quantities from definition
    const matches = discountDefinition.match(/\{(.*?)\}/);
    if (matches) {
      const discountInfo = matches[1];
      const discounts = discountInfo.split("|").map(entry => {
        const [qtyRange, discountPercentage] = entry.split("-");
        return { qtyRange, discountPercentage };
      });

      // Iterate through each discount range
      for (const discount of discounts) {
        const minQty = parseInt(discount.qtyRange); // Single quantity value for this range
        if (quantity >= minQty) {
          const discountPercentage = parseInt(discount.discountPercentage);
          price = listPrice * (1 - discountPercentage / 100);
        }
      }
    }
  }

  return price;
};

const precartWebhookHandler = async req => {
  const headers = { "foxy-http-method-override": "PUT" };
  const foxyReq = await req.json();
  console.log("FOXY REQUEST:", JSON.stringify(foxyReq));
  const addedProduct = foxyReq.query;
  let cart = foxyReq?.body ? JSON.parse(foxyReq.body) : null;
  console.log("cart: ", cart);

  let items = cart._embedded["fx:items"];
  console.log("cart items: ", items);
  if (!foxyReq?.cookies?.fcsid) {
    console.log("No existing session, switching to a POST");
    headers["foxy-http-method-override"] = "POST";
  }

  const newCart = emptyCartBody({
    attributes: [],
    items: [],
    coupons: [],
  });

  // Modify the price of the added product based on quantity discount
  if (addedProduct.list_price && addedProduct.discount_quantity_percentage) {
    const listPrice = parseFloat(addedProduct.list_price);
    const quantity = parseInt(addedProduct.quantity);
    const price = parseInt(addedProduct.price);

    const adjustedPrice = calculatePrice(
      price,
      listPrice,
      quantity,
      addedProduct.discount_quantity_percentage
    );

    // Add a new item with adjusted price to the cart
    const newItem = emptyItemBody({
      // Use emptyItemBody function to create a new item
      name: "Adjusted Product",
      price: adjustedPrice.toFixed(2),
      quantity: 1, // Assuming quantity is always 1 for the new item
    });
    newCart._embedded["fx:items"].push(newItem);

    return new Response({ headers, statusCode: 200, body: JSON.stringify(newCart) });
  }

  return new Response({ headers, statusCode: 304 });
};

export default async (req, context) => {
  return precartWebhookHandler(req);
};
