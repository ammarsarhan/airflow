// Controller handles extracting the data from the request, 
// validating the data, 
// passing it to the service, 
// and returning a valid response.

import { Request, Response } from "express";
import AuthService from "@/domains/auth/auth.service";

class AuthController {
    // private keyword automatically assigns this.service to service.
    constructor (private service: AuthService) { };

    // Uses arrow function to automatically bind this.
    signUpUser = async (req: Request, res: Response) => {
        return res.status(200).json({ message: "Hit endpoint." });
    };
};

export default AuthController;
