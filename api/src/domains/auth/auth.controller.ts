import { Request, Response, NextFunction } from "express";

class AuthController {
    async signUpUserWithCredentials(req: Request, res: Response, next: NextFunction) {
        return res.status(200).json({ message: "Hit endpoint." });
    }
};

export default AuthController;
