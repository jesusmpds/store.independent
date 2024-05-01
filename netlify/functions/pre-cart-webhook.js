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
  const d = p.definition;
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

const precartWebhookHandler = async req => {
  const headers = { "foxy-http-method-override": "PUT" };
  const foxyReq = await req.json();
  console.log(foxyReq);
  const cart = JSON.parse(foxyReq.body);
  console.log("cart: ", cart);

  if (!foxyReq?.cookies?.fcsid || (Array.isArray(foxyBody) && !foxyBody.length)) {
    console.log("No existing session, switching to a POST");
    headers["foxy-http-method-override"] = "POST";
  }

  return { headers, statusCode: 200 };
};

export default async (req, context) => {
  return precartWebhookHandler(req);
};
