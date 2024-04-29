import { DelivererController } from '../DelivererController'
import { createMockReqRes } from '../../../utils/tests/testHelpers'
import { IDelivererService } from '../../../application/interfaces/IDelivererService'
import { IDelivererModel } from '../../../domain/Deliverer'
import { ZodError } from 'zod'

describe('DelivererController', () => {
    let controller: DelivererController
    let mockDelivererService: jest.Mocked<IDelivererService>

    let delivererData = beforeEach(() => {
        mockDelivererService = {
            registerDeliverer: jest.fn(),
            paginate: jest.fn(),
        }

        delivererData = {
            email: 'user@example.com',
            name: 'UserName',
            cnpj: '65426424000168',
            birthDate: '2000-01-01',
            driverLicenseNumber: '34148340222',
            driverLicenseType: 'A',
            userType: 'deliverer',
            driverLicenseImageURL: undefined,
        }

        controller = new DelivererController(mockDelivererService)
    })

    describe('register', () => {
        it('should register a deliverer successfully and return the appropriate response', async () => {
            const body = {
                ...delivererData,
                password: 'userpass',
                passwordConfirmation: 'userpass',
            }

            const { req, res, next } = createMockReqRes({
                body,
            })

            mockDelivererService.registerDeliverer.mockResolvedValue({
                ...delivererData,
                _id: 'foo-id',
            } as unknown as IDelivererModel)

            await controller.register(req, res, next)

            expect(mockDelivererService.registerDeliverer).toHaveBeenCalledWith(
                body
            )
            expect(res.status).toHaveBeenCalledWith(201)
            expect(res.json).toHaveBeenCalledWith({
                data: {
                    ...delivererData,
                    password: undefined,
                    passwordConfirmation: undefined,
                },
            })
        })

        it('should handle errors if registration fails due to service layer failure', async () => {
            const { req, res, next } = createMockReqRes({
                body: { email: 'failuser@example.com', password: 'failpass' },
            })

            const error = new Error('Service failure')
            mockDelivererService.registerDeliverer.mockRejectedValue(error)

            await controller.register(req, res, next)

            expect(next).toHaveBeenCalledWith(expect.any(ZodError))
        })
    })

    describe('paginate', () => {
        it('should successfully fetch paginated results and return them', async () => {
            const { req, res, next } = createMockReqRes({
                query: { page: '1', perPage: '10' },
            })

            const mockPaginatedData = {
                ...delivererData,
            } as unknown as IDelivererModel

            mockDelivererService.paginate.mockResolvedValue([mockPaginatedData])

            await controller.paginate(req, res, next)

            expect(mockDelivererService.paginate).toHaveBeenCalledWith({
                filters: {},
                paginate: { page: 1, perPage: 10 },
            })
            expect(res.status).toHaveBeenCalledWith(200)
            expect(res.json).toHaveBeenCalledWith({
                data: [mockPaginatedData],
                paginate: {
                    page: 1,
                    perPage: 10,
                },
            })
        })

        it('should handle errors if pagination fails due to service layer failure', async () => {
            const { req, res, next } = createMockReqRes({
                query: {
                    page: '1',
                    perPage: '10',
                    cnpj: '7367234000185',
                    driverLicenseNumber: '123456',
                },
            })

            await controller.paginate(req, res, next)

            expect(next).toHaveBeenCalledWith(expect.any(ZodError))
        })
    })
})
