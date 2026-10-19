import { BusinessRuleError } from '../../../shared/errors/index.js';
import { ReservationStatus as Status } from './reservation-status.js';
export class InventoryReservation {
    id;
    tenantId;
    stockLocationId;
    productId;
    referenceType;
    referenceId;
    quantity;
    status;
    createdAt;
    releasedAt;
    constructor(props) {
        this.id = props.id;
        this.tenantId = props.tenantId;
        this.stockLocationId = props.stockLocationId;
        this.productId = props.productId;
        this.referenceType = props.referenceType;
        this.referenceId = props.referenceId;
        this.quantity = props.quantity;
        this.status = props.status;
        this.createdAt = props.createdAt;
        this.releasedAt = props.releasedAt;
    }
    static reconstitute(props) {
        return new InventoryReservation(props);
    }
    assertActive() {
        if (this.status !== Status.ACTIVE) {
            throw new BusinessRuleError('Reservation is not active', {
                reservationId: this.id,
                status: this.status,
            });
        }
    }
    isReleased() {
        return this.status === Status.RELEASED;
    }
}
