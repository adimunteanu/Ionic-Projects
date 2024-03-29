import { Injectable } from '@angular/core';
import { Place } from './place.model';
import { AuthService } from '../auth/auth.service';
import { BehaviorSubject, of } from 'rxjs';
import { take, map, tap, switchMap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';


// new Place(
//   'p1',
//   'Manhattan Mansion',
//   'In the heart of New York City.',
//   'https://static.mansionglobal.com/production/media/article-images/8b6775fa0db27ccc4a5aa3fe8d13f8cc/large_053.jpg',
//   149.99,
//   new Date('2019-01-01'),
//   new Date('2019-12-31'),
//   'abc'
// ),
// new Place(
//   'p2',
//   'L\'Amour Toujours',
//   'Romantic place in Paris.',
//   'https://i.pinimg.com/originals/a9/45/72/a945725c0dc12770bb831e8d9fbc2fe6.png',
//   189.99,
//   new Date('2019-01-01'),
//   new Date('2019-12-31'),
//   'abc'
// ),
// new Place(
//   'p3',
//   'The Foggy Palace',
//   'Not your average city trip!',
//   'https://data.whicdn.com/images/292751032/original.jpg',
//   99.99,
//   new Date('2019-01-01'),
//   new Date('2019-12-31'),
//   'xyz'
// )


interface PlaceData {
	availableFrom: string;
	availableTo: string;
	description: string;
	imageUrl: string;
	price: number;
	title: string;
	userId: string;
}

@Injectable({
	providedIn: 'root'
})
export class PlacesService {
	private _places = new BehaviorSubject<Place[]>([]);

	get places() {
		return this._places.asObservable();
	}

	constructor(
		private authService: AuthService,
		private http: HttpClient
	) { }

	fetchPlaces() {
		return this.authService.token
			.pipe(
				take(1),
				switchMap(token => {
					return this.http
						.get<{ [key: string]: PlaceData }>(`https://ionic-angular-booking-ap-5f860.firebaseio.com/offered-places.json?auth=${token}`)
				}),
				map(resData => {
					const places = [];
					for (const key in resData) {
						if (resData.hasOwnProperty(key)) {
							places.push(new Place(
								key,
								resData[key].title,
								resData[key].description,
								resData[key].imageUrl,
								resData[key].price,
								new Date(resData[key].availableFrom),
								new Date(resData[key].availableTo),
								resData[key].userId
							));
						}
					}
					return places;
				}),
				tap(places => {
					this._places.next(places);
				})
			);
	}

	getPlace(id: string) {
		return this.authService.token
			.pipe(
				take(1),
				switchMap(token => {
					return this.http
						.get<PlaceData>(`https://ionic-angular-booking-ap-5f860.firebaseio.com/offered-places/${id}.json?auth=${token}`)
				}),
				map(placeData => {
					return new Place(
						id,
						placeData.title,
						placeData.description,
						placeData.imageUrl,
						placeData.price,
						new Date(placeData.availableFrom),
						new Date(placeData.availableTo),
						placeData.userId)
				})
			);
	}

	uploadImage(image: File) {
		const uploadData = new FormData();
		uploadData.append('image', image);

		return this.authService.token
			.pipe(
				take(1),
				switchMap(token => {
					return this.http.post<{ imageUrl: string, imagePath: string }>(
						'https://us-central1-ionic-angular-booking-ap-5f860.cloudfunctions.net/storeImage',
						uploadData,
						{ headers: { Authorization: 'Bearer ' + token } }
					);
				})
			)
	}

	addPlace(
		title: string,
		description: string,
		price: number,
		dateFrom: Date,
		dateTo: Date,
		imageUrl: string
	) {
		let generatedId: string;
		let fetchedUserId: string;
		let newPlace: Place;
		return this.authService.userId
			.pipe(
				take(1),
				switchMap(user => {
					fetchedUserId = user;
					return this.authService.token;
				}),
				take(1),
				switchMap(token => {
					if (!fetchedUserId) {
						throw new Error('No user found!');
					}

					newPlace = new Place(
						Math.random.toString(),
						title,
						description,
						imageUrl,
						price,
						dateFrom,
						dateTo,
						fetchedUserId
					);

					return this.http
						.post<{ name: string }>(`https://ionic-angular-booking-ap-5f860.firebaseio.com/offered-places.json?auth=${token}`, {
							...newPlace,
							id: null
						})
				}),
				switchMap(resData => {
					generatedId = resData.name;
					return this.places;
				}),
				take(1),
				tap(places => {
					newPlace.id = generatedId;
					this._places.next(places.concat(newPlace));
				})
			);
	}

	updatePlace(placeId: string, title: string, description: string) {
		let updatedPlaces: Place[];
		let fetchedToken: string;
		return this.authService.token
			.pipe(
				take(1),
				switchMap(token => {
					fetchedToken = token;
					return this.places;
				}),
				take(1),
				switchMap(places => {
					if (!places || places.length <= 0) {
						return this.fetchPlaces();
					} else {
						return of(places);
					}
				}),
				switchMap(places => {
					const updatedPlaceIndex = places.findIndex(pl => pl.id === placeId);
					updatedPlaces = [...places];
					const oldPlace = updatedPlaces[updatedPlaceIndex];
					updatedPlaces[updatedPlaceIndex] = new Place(
						oldPlace.id,
						title,
						description,
						oldPlace.imageUrl,
						oldPlace.price,
						oldPlace.availableFrom,
						oldPlace.availableTo,
						oldPlace.userId
					);
					return this.http.put(
						`https://ionic-angular-booking-ap-5f860.firebaseio.com/offered-places/${placeId}.json?auth=${fetchedToken}`,
						{ ...updatedPlaces[updatedPlaceIndex], id: null }
					);
				}),
				tap(() => {
					this._places.next(updatedPlaces);
				})
			);
	}
}
