const defaultCategoryID = "149466";

const emptyCartBody = data => {
  // Need an empty cart to start with.
  return {
    _embedded: {
      "fx:items": data.items,
      // "fx:custom_fields": data.custom_fields,
    },
    customer_uri: null,
    template_set_uri: null,
    payment_method_uri: null,
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
  data.item_category_uri =
    data.item_category_uri || `https://api.foxycart.com/item_categories/${defaultCategoryID}`;
  return {
    item_category_uri: data.item_category_uri,
    name: data.name,
    price: data.price,
    quantity: parseInt(data.quantity) || 1,
    quantity_min: data.quantity_min || 0,
    quantity_max: data.quantity_max || 0,
    weight: data.weight || "",
    code: data.code,
    parent_code: data.parent_code || "",
    discount_name: data.discount_name || null,
    discount_type: data.discount_type || null,
    discount_details: data.discount_details || null,
    subscription_frequency: data.subscription_frequency || null,
    subscription_start_date: data.subscription_start_date || null,
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

const removeLinksProperty = obj => {
  // Check if the object has a _links property and delete it
  if (obj.hasOwnProperty("_links")) {
    delete obj["_links"];
  }

  // Iterate over the object's properties
  for (let key in obj) {
    if (obj.hasOwnProperty(key) && typeof obj[key] === "object" && obj[key] !== null) {
      // Recursively call removeLinksProperty on nested objects
      removeLinksProperty(obj[key]);
    }
  }
};

const createItemFromSkeleton = d => {
  const item = emptyItemBody({
    category: d.category,
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

  // Copy item options and remove _links property
  const itemOptions = d.options ? [...d.options] : d._embedded["fx:item_options"];
  itemOptions.forEach(option => removeLinksProperty(option));

  item._embedded["fx:item_options"] = itemOptions;
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
          price = listPrice;
          break;
        }
      }
    }
  }

  return price;
};

const precartWebhookHandler = async req => {
  const headers = { "foxy-http-method-override": "PUT" };
  const foxyReq = await req.json();
  const addedProductQuery = foxyReq.query;
  let cartObject = foxyReq?.body ? JSON.parse(foxyReq.body) : null;
  console.log("addedProductQuery: ", addedProductQuery);

  if (addedProductQuery.cart === "update" && addedProductQuery["1:quantity"] === "0") {
    console.log("Responded early, this was a product removal.");
    return new Response(null, { headers, status: 304 });
  }

  let items = cartObject.cart_data._embedded?.["fx:items"];
  console.log("CART DATA", cartObject.cart_data);
  if (!foxyReq?.cookies?.fcsid || !items) {
    console.log("No existing session or cart items, switching to a POST");
    headers["foxy-http-method-override"] = "POST";

    if (!cartObject.cart_data.length) {
      cartObject.cart_data = { _embedded: { "fx:items": [] } };
    }

    items = cartObject.cart_data?._embedded?.["fx:items"];
  }

  const options = [];
  const addedProduct = Object.fromEntries(
    Object.entries(addedProductQuery).map(([name, value]) => {
      const foxyProductOptions = [
        "category",
        "name",
        "price",
        "quantity",
        "quantity_min",
        "quantity_max",
        "weight",
        "code",
        "parent_code",
        "discount_name",
        "discount",
        "discount_quantity_percentage",
        "discount_details",
        "subscription_frequency",
        "subscription_start_date",
        "subscription_end_date",
        "shipto",
        "url",
        "image",
        "length",
        "width",
        "height",
        "expires",
        "fcsid",
        "callback",
      ];

      if (!foxyProductOptions.includes(name)) {
        options.push({ name: name, value: value });
      }
      return [name, value];
    })
  );
  addedProduct.options = options;
  console.log("options", options);

  // Modify the price of the added product based on quantity discount
  if (addedProduct.list_price && addedProduct.discount_quantity_percentage) {
    const listPrice = parseFloat(addedProduct.list_price);
    const quantity = parseInt(addedProduct.quantity);
    const salePrice = parseFloat(addedProduct.price);

    const adjustedPrice = calculatePrice(
      salePrice,
      listPrice,
      quantity,
      addedProduct.discount_quantity_percentage
    );
    addedProduct.price = adjustedPrice;

    if (adjustedPrice !== salePrice) {
      const item = createItemFromSkeleton(addedProduct);
      console.log("item", item);

      const newCart = emptyCartBody({
        items: [...items.map(item => createItemFromSkeleton(item)), item],
      });
      console.log("ADDED CART", JSON.stringify(newCart, null, 2));
      return Response.json(JSON.stringify(newCart), { headers });
    }
  }

  return Response.json({ status: 304 });
};

export default async (req, context) => {
  return precartWebhookHandler(req);
};
