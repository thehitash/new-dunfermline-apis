try {
    const orderId = req.body.id;
    let trip = await Trips.findOne({ orderId: orderId });
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    let session;
    try {
      session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        payment_intent_data: {
          capture_method: "manual",
        },
        success_url: `${process.env.BASE_URL}/stripe/success?id=${orderId}`,
        cancel_url: `${process.env.BASE_URL}/stripe/cancel?id=${orderId}`,
        line_items: [
          {
            price_data: {
              currency: "aud",
              product_data: { name: order.orderId },
              unit_amount: totalAmount,
            },
            quantity: 1,
          },
        ],
      });
    } catch (error) {
      console.log("Stripe Error:", error);
      return res.status(500).json({ error: "Stripe session creation failed." });
    }

    const repo = await Order.findOne({ orderId: order.orderId });
    repo.stripePaySessionId = session.id;
    repo.cardChargePercent = CARD_COMISSION;
    repo.serviceCharges = SERVICE_CHARGES;
    repo.cardChargeAmount = cardChargeAmount;
    await repo.save();

    res.json({ id: session.id });
  } catch (error) {
    console.log("Main Error:", error);
    res.status(500).json({ error: error.message });
  }