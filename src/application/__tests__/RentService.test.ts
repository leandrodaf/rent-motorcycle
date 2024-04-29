import { RentService } from '../RentService'
import { IDelivererService } from '../interfaces/IDelivererService'
import { IRentPlanRepository } from '../interfaces/IRentPlanRepository'
import { IRentRepository } from '../interfaces/IRentRepository'
import { DriverLicenseType, IDelivererModel } from '../../domain/Deliverer'
import { IRent, IRentModel, RentStatus } from '../../domain/Rent'
import { CustomError } from '../../utils/handdlers/CustomError'
import { StatusCodes } from 'http-status-codes'
import { DateTime } from 'luxon'
import { FilterQuery } from '../../infrastructure/api/requesters/queries/PaginateQuery'

const mockDelivererService: jest.Mocked<IDelivererService> = {
    findById: jest.fn(),
    registerDeliverer: jest.fn(),
    paginate: jest.fn(),
    attachDocument: jest.fn(),
}

const mockRentPlanRepository: jest.Mocked<IRentPlanRepository> = {
    findBy: jest.fn(),
}

const mockRentRepository: jest.Mocked<IRentRepository> = {
    create: jest.fn(),
    filter: jest.fn(),
}

describe('RentService', () => {
    let service: RentService
    let originalNow: any

    const deliverer = {
        _id: '1',

        driverLicenseType: DriverLicenseType.A,
    } as unknown as IDelivererModel

    beforeAll(() => {
        originalNow = DateTime.now
        DateTime.now = () => DateTime.fromISO('2024-04-30T00:00:00.000Z') as any
    })

    afterAll(() => {
        DateTime.now = originalNow
    })

    beforeEach(() => {
        jest.clearAllMocks()
        service = new RentService(
            mockRentRepository,
            mockDelivererService,
            mockRentPlanRepository
        )
    })

    describe('renting', () => {
        it('should throw an error if no rental plan is available for the specified date range', async () => {
            const startDate = new Date('2024-05-01')
            const endDate = new Date('2025-05-15')

            const authorizedDeliverer = {
                _id: '1',
                driverLicenseType: DriverLicenseType.A,
            } as IDelivererModel

            mockDelivererService.findById.mockResolvedValue(authorizedDeliverer)
            mockRentPlanRepository.findBy.mockReturnValue(undefined)

            await expect(
                service.renting('1', startDate, endDate)
            ).rejects.toThrow(
                new CustomError(
                    'No rental plan available for the specified range dates.',
                    StatusCodes.BAD_REQUEST
                )
            )

            // Verificar que não tentamos criar uma reserva
            expect(mockRentRepository.create).not.toHaveBeenCalled()
        })

        it('should throw an error if the deliverer is not authorized to rent a motorcycle', async () => {
            const startDate = new Date('2024-05-01')
            const endDate = new Date('2024-05-08')

            const unauthorizedDeliverer = {
                _id: '2',
                driverLicenseType: DriverLicenseType.B,
            } as IDelivererModel

            mockDelivererService.findById.mockResolvedValue(
                unauthorizedDeliverer
            )

            await expect(
                service.renting('2', startDate, endDate)
            ).rejects.toThrow(
                new CustomError(
                    'Deliverer is not authorized to rent a motorcycle.',
                    StatusCodes.BAD_REQUEST
                )
            )

            expect(mockRentRepository.create).not.toHaveBeenCalled()
        })

        it('should throw an error if the date range is invalid', async () => {
            const startDate = new Date('2024-04-29')
            const endDate = new Date('2024-05-05')

            mockDelivererService.findById.mockResolvedValue(deliverer)

            await expect(
                service.renting('1', startDate, endDate)
            ).rejects.toThrow(
                new CustomError(
                    'Reservation dates cannot be today or a past date.',
                    StatusCodes.BAD_REQUEST
                )
            )
        })

        it('should select the correct rental plan based on the date range', async () => {
            const startDate = new Date('2024-05-01')
            const endDate = new Date('2024-05-08') // 7 days
            const expectedRent = {
                deliverer,
                startDate,
                endDate,
                deliveryForecastDate: endDate,
                totalCost: 21000, // 3000 * 7 days
                status: RentStatus.PROCESSING,
                plan: {
                    days: 7,
                    dailyRate: 3000,
                },
            } as IRentModel

            mockDelivererService.findById.mockResolvedValue(deliverer)
            mockRentPlanRepository.findBy.mockReturnValue({
                days: 7,
                dailyRate: 3000,
            })
            mockRentRepository.create.mockResolvedValue(expectedRent)

            const result = await service.renting('1', startDate, endDate)

            expect(mockRentPlanRepository.findBy).toHaveBeenCalledWith(7)
            expect(mockRentRepository.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    plan: { dailyRate: 3000, days: 7 },
                })
            )
            expect(result).toEqual(expectedRent)
        })
    })

    describe('paginate', () => {
        it('should call the repository to paginate rents and return the results', async () => {
            const mockRents = [
                {
                    id: '123',
                    delivererId: '456',
                    startDate: new Date('2024-04-30'),
                    endDate: new Date('2024-05-10'),
                    plan: { days: 10, dailyRate: 2000 },
                    status: RentStatus.PROCESSING,
                    totalCost: 20000,
                    deliveryForecastDate: new Date('2024-05-10'),
                } as unknown as IRentModel,
            ]

            const search = {
                filters: { delivererId: '456' },
                paginate: { page: 1, perPage: 10 },
            } as FilterQuery<Partial<IRent>>

            mockRentRepository.filter.mockResolvedValue(mockRents)

            const result = await service.paginate(search)

            expect(mockRentRepository.filter).toHaveBeenCalledWith(
                search.filters,
                search.paginate
            )
            expect(result).toEqual(mockRents)
        })

        it('should return an empty array if no rents are found', async () => {
            const search = {
                filters: { status: 'foo-status' },
                paginate: { page: 1, perPage: 10 },
            } as unknown as FilterQuery<Partial<IRent>>

            mockRentRepository.filter.mockResolvedValue([])

            const result = await service.paginate(search)

            expect(mockRentRepository.filter).toHaveBeenCalledWith(
                search.filters,
                search.paginate
            )
            expect(result).toEqual([])
        })

        it('should handle errors from the repository', async () => {
            const search = {
                filters: { delivererId: '456' },
                paginate: { page: 1, perPage: 10 },
            } as FilterQuery<Partial<IRent>>

            const error = new Error('Database error')

            mockRentRepository.filter.mockRejectedValue(error)

            await expect(service.paginate(search)).rejects.toThrow(error)
        })
    })
})
