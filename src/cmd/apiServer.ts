import express from 'express'
import { ICMD } from './ICMD'
import { UserRepository } from '../infrastructure/repository/UserRepository'
import { AuthService } from '../application/UserService'
import { AuthController } from '../infrastructure/api/AuthController'
import { MongoConnectionManager } from '../infrastructure/database/MongoConnectionManager'
import { ErrorHandlingMiddleware } from '../infrastructure/api/middlewares/ErrorHandlingMiddleware'
import { DelivererController } from '../infrastructure/api/DelivererController'
import { DelivererRepository } from '../infrastructure/repository/DelivererRepository'
import { DelivererService } from '../application/DelivererService'

export class APIServer implements ICMD {
    private app: express.Application

    constructor() {
        this.app = express()
        this.setupRoutes()
        this.setupErrorHandling()
    }

    private setupRoutes(): void {
        const userRepository = new UserRepository()
        const delivererRepository = new DelivererRepository()

        const authService = new AuthService(userRepository)
        const delivererService = new DelivererService(delivererRepository)

        const authController = new AuthController(authService)

        const delivererController = new DelivererController(delivererService)

        this.app.use(express.json())

        this.app.post('/auth/login', authController.login.bind(authController))

        this.app.post(
            '/deliverers',
            delivererController.register.bind(delivererController)
        )
    }

    private setupErrorHandling(): void {
        this.app.use(ErrorHandlingMiddleware())
    }

    public async start() {
        await new MongoConnectionManager().initialize()

        const port = process.env.PORT || 3000

        this.app.listen(port, () => {
            console.log(`API Server listening on port ${port}`)
        })
    }
}
