import { ObjectId } from "mongodb";

export default class Data {
    constructor(public price: any, public customer: any,
                 public product: any, public invoice: any) {}
}