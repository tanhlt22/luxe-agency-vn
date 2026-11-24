import { Routes } from '@angular/router';
import { Home } from './features/home/home';
import { EventGallery } from './features/event-gallery/event-gallery';
import { Portfolio } from './features/portfolio/portfolio';
import { ServicesPage } from './features/services-page/services-page';
import { Contact } from './features/contact/contact';
import { SoftwarePage } from './features/software-page/software-page';
import { SelfBoothBookingComponent } from './features/selfbooth/booking/selfbooth-booking';
import { SelfBoothTicketQueueComponent } from './features/selfbooth/ticket-queue/selfbooth-ticket-queue';
import { SelfBoothComposerComponent } from './features/selfbooth/composer/selfbooth-composer';
import { SelfBoothAdminComponent } from './features/admin/selfbooth-admin';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'event/:id', component: EventGallery },
  { path: 'portfolio', component: Portfolio },
  { path: 'services', component: ServicesPage },
  { path: 'software', component: SoftwarePage },
  { path: 'contact', component: Contact },
  { path: 'selfbooth', component: SelfBoothBookingComponent },
  { path: 'selfbooth/ticket/:code', component: SelfBoothTicketQueueComponent },
  { path: 'selfbooth/compose', component: SelfBoothComposerComponent },
  { path: 'admin', component: SelfBoothAdminComponent }
];
