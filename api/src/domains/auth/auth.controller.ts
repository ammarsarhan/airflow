// Controller handles extracting the data from the request, 
// validating the data, 
// passing it to the service, 
// and returning a valid response.

import { Request, Response } from "express";
import AuthService from "@/domains/auth/auth.service";
import { validateSignUpPayload } from "@/domains/auth/auth.validator";

class AuthController {
    // private keyword automatically assigns this.service to service.
    constructor (private service: AuthService) { };

    // Uses arrow function to automatically bind this.
    signUp = async (req: Request, res: Response) => {
        try {
            const payload = req.body;

            const data = validateSignUpPayload(payload);
            const user = await this.service.signUpWithCredentials(data);
    
            return res.status(200).json({ message: "Created user account successfully.", data: user });
        } catch (error: any) {
            return res.status(500).json({ message: `An unknown error has occurred. ${error.message}` });
        }
    };
};

export default AuthController;
