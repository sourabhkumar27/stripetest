import env from "dotenv";
import path from "path";
import { connectToDatabase, saveToDatabase } from "./database";

// Replace if using a different env file or config.
env.config({ path: "./.env" });

import bodyParser from "body-parser";
import express from "express";

import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2020-08-27",
  appInfo: { // For sample support and debugging, not required for production:
    name: "stripeSDK smaple",
    url: "....",
    version: "0.0.2",
  },
  typescript: true,
});

const app = express();
const resolve = path.resolve;

connectToDatabase();

app.use(express.static(process.env.STATIC_DIR));
app.use(
  (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ): void => {
    if (req.originalUrl === "/webhook") {
      next();
    } else {
      bodyParser.json()(req, res, next);
    }
  }
);

app.get("/", (_: express.Request, res: express.Response): void => {
  // Serve checkout page.
  const indexPath = resolve(process.env.STATIC_DIR + "/index.html");
  res.sendFile(indexPath);
});

app.get("/config", (_: express.Request, res: express.Response): void => {
  // Serve checkout page.
  res.send({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
  });
});

app.get(
  "/create-payment-intent",
  async (req: express.Request, res: express.Response): Promise<void> => {
    // Create a PaymentIntent with the order amount and currency.
    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: 1999,
      currency: 'EUR',
      automatic_payment_methods: {
        enabled: true,
      }
    }

    const customerParams: Stripe.CustomerCreateParams = {
      email: "sourabhk572@gmail.com",
      name: "Sourabh Kumar"
    };

    const productParams: Stripe.ProductCreateParams = {
      id: "product_id_" + Math.random().toString().slice(2),
      name: "product_name_" + Math.random().toString().slice(2)
    };

    try {
      const paymentIntent: Stripe.PaymentIntent = await stripe.paymentIntents.create(
        paymentIntentParams
      );

      const customer: Stripe.Customer = await stripe.customers.create(customerParams);

      const product: Stripe.Product = await stripe.products.create(productParams);

      const price: Stripe.Price = await stripe.prices.create({
        currency: "cad",
        unit_amount: 20,
        product: product.id
      });

      //Create invoice Item
      const invoiceItem: Stripe.InvoiceItem = await stripe.invoiceItems.create({ // You can create an invoice item after the invoice
        customer: customer.id,
        price: price.id
      });

       // Create an Invoice
      const invoice: Stripe.Invoice = await stripe.invoices.create({
        customer: customer.id,
        collection_method: 'send_invoice',
        days_until_due: 30
      });

      // Send the Invoice
      await stripe.invoices.sendInvoice(invoice.id);

      // console.log("Server Console: ", paymentIntent, customer, product, invoice);

      saveToDatabase({
        product:product,
        customer:customer,
        invoice:invoice,
        price: price
      })

      // Send publishable key and PaymentIntent client_secret to client.
      res.send({
        clientSecret: paymentIntent.client_secret,
        customer: customer
      });
    } catch (e) {
      console.log("Error: ", e);
      res.status(400).send({
        error: {
          message: e.message,
        }
      });
    }
  }
);

// Expose a endpoint as a webhook handler for asynchronous events.
// Configure your webhook in the stripe developer dashboard:
// https://dashboard.stripe.com/test/webhooks
app.post(
  "/webhook",
  // Use body-parser to retrieve the raw body as a buffer.
  bodyParser.raw({ type: "application/json" }),
  async (req: express.Request, res: express.Response): Promise<void> => {
    // Retrieve the event by verifying the signature using the raw body and secret.
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers["stripe-signature"],
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.log(`⚠️  Webhook signature verification failed.`);
      res.sendStatus(400);
      return;
    }

    // Extract the data from the event.
    const data: Stripe.Event.Data = event.data;
    const eventType: string = event.type;

    if (eventType === "payment_intent.succeeded") {
      // Cast the event into a PaymentIntent to make use of the types.
      const pi: Stripe.PaymentIntent = data.object as Stripe.PaymentIntent;
      // Funds have been captured
      // Fulfill any orders, e-mail receipts, etc
      // To cancel the payment after capture you will need to issue a Refund (https://stripe.com/docs/api/refunds).
      console.log(`🔔  Webhook received: ${pi.object} ${pi.status}!`);
      console.log("💰 Payment captured!");
    } else if (eventType === "payment_intent.payment_failed") {
      // Cast the event into a PaymentIntent to make use of the types.
      const pi: Stripe.PaymentIntent = data.object as Stripe.PaymentIntent;
      console.log(`🔔  Webhook received: ${pi.object} ${pi.status}!`);
      console.log("❌ Payment failed.");
    }
    res.sendStatus(200);
  }
);

app.listen(4242, (): void =>
  console.log(`Node server listening on port ${4242}!`)
);
